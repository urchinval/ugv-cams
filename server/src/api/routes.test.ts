import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { config } from '../config.ts';
import { Core } from '../core.ts';
import { MediaMtxSupervisor } from '../mtx/supervisor.ts';
import { ModelStore } from '../store/models.ts';
import { SettingsStore } from '../store/settings.ts';

let dir: string;
let app: FastifyInstance;
let mtxFile: string;

const modelBody = {
  name: 'Lynx 2407',
  cameras: [
    {
      id: 'front',
      label: 'Front',
      streams: {
        sub: 'rtsp://u:p@192.168.18.106:554/s1',
        main: 'rtsp://u:p@192.168.18.106:554/s0',
        third: '',
      },
    },
    { id: 'rear', label: 'Rear', streams: { sub: 'rtsp://u:p@192.168.18.108:554/s1' } },
  ],
};

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ugv-cams-test-'));
  mtxFile = join(dir, 'runtime', 'mediamtx.yml');
  const cfg = { ...config, dataDir: dir, webDir: join(dir, 'no-web') };
  const models = new ModelStore(join(dir, 'models'));
  await models.init();
  const settings = new SettingsStore(join(dir, 'settings.json'));
  await settings.init();
  // supervisor is never started: only its writeConfig is exercised
  const mtx = new MediaMtxSupervisor('/nonexistent/mediamtx', mtxFile, dir);
  const core = new Core(cfg, models, settings, mtx);
  await core.applyActive();
  app = await buildApp(core, cfg);
});

after(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

test('model lifecycle: create -> select -> layout -> export/import -> delete', async () => {
  // validation error shape
  const bad = await app.inject({
    method: 'POST',
    url: '/api/models',
    payload: { name: '', cameras: [] },
  });
  assert.equal(bad.statusCode, 400);
  assert.ok(bad.json().issues.length >= 2);

  const created = await app.inject({ method: 'POST', url: '/api/models', payload: modelBody });
  assert.equal(created.statusCode, 201);
  const model = created.json();
  assert.match(model.id, /^[a-f0-9]{10}$/);
  assert.equal(model.cameras[0].streams.third, null);

  const list = await app.inject({ method: 'GET', url: '/api/models' });
  assert.deepEqual(
    list.json().map((m: { name: string }) => m.name),
    ['Lynx 2407'],
  );

  // nothing active yet
  assert.equal((await app.inject({ method: 'GET', url: '/api/active' })).json().model, null);
  assert.deepEqual(parse(await readFile(mtxFile, 'utf8')).paths, {});

  // select -> yml rendered
  const sel = await app.inject({
    method: 'PUT',
    url: '/api/active',
    payload: { modelId: model.id },
  });
  assert.equal(sel.json().model.id, model.id);
  assert.deepEqual(Object.keys(parse(await readFile(mtxFile, 'utf8')).paths).sort(), [
    'front_main',
    'front_sub',
    'rear_sub',
  ]);

  // update active model -> yml re-rendered
  const upd = await app.inject({
    method: 'PUT',
    url: `/api/models/${model.id}`,
    payload: { ...modelBody, cameras: [modelBody.cameras[0]] },
  });
  assert.equal(upd.statusCode, 200);
  assert.deepEqual(Object.keys(parse(await readFile(mtxFile, 'utf8')).paths).sort(), [
    'front_main',
    'front_sub',
  ]);

  // layout: default, save, unknown camera rejected, reset
  const lay = (await app.inject({ method: 'GET', url: `/api/models/${model.id}/layout` })).json()
    .layout;
  assert.deepEqual(lay, [{ i: 'front', x: 0, y: 0, w: 12, h: 12 }]);
  const badLay = await app.inject({
    method: 'PUT',
    url: `/api/models/${model.id}/layout`,
    payload: { layout: [{ i: 'ghost', x: 0, y: 0, w: 1, h: 1 }] },
  });
  assert.equal(badLay.statusCode, 400);
  const saved = await app.inject({
    method: 'PUT',
    url: `/api/models/${model.id}/layout`,
    payload: { layout: [{ i: 'front', x: 2, y: 0, w: 8, h: 8 }] },
  });
  assert.equal(saved.json().layout[0].w, 8);

  // export -> import gives a new model with the same cameras
  const exp = await app.inject({ method: 'GET', url: `/api/models/${model.id}/export` });
  assert.match(exp.headers['content-disposition'] as string, /attachment/);
  const imp = await app.inject({ method: 'POST', url: '/api/models/import', payload: exp.json() });
  assert.equal(imp.statusCode, 201);
  assert.notEqual(imp.json().id, model.id);
  assert.deepEqual(imp.json().cameras, upd.json().cameras);

  // delete active -> selection cleared, yml emptied
  const del = await app.inject({ method: 'DELETE', url: `/api/models/${model.id}` });
  assert.equal(del.statusCode, 204);
  assert.equal((await app.inject({ method: 'GET', url: '/api/active' })).json().model, null);
  assert.deepEqual(parse(await readFile(mtxFile, 'utf8')).paths, {});
  assert.equal(
    (await app.inject({ method: 'GET', url: `/api/models/${model.id}` })).statusCode,
    404,
  );
});

test('status reports MediaMTX not running', async () => {
  const s = (await app.inject({ method: 'GET', url: '/api/status' })).json();
  assert.equal(s.mediamtx.running, false);
  assert.deepEqual(s.paths, {});
});

test('Fastify client errors keep their status instead of becoming 500', async () => {
  const badJson = await app.inject({
    method: 'POST',
    url: '/api/models',
    headers: { 'content-type': 'application/json' },
    payload: '{"name":',
  });
  assert.equal(badJson.statusCode, 400);
  const wrongType = await app.inject({
    method: 'POST',
    url: '/api/models',
    headers: { 'content-type': 'application/xml' },
    payload: '<model/>',
  });
  assert.equal(wrongType.statusCode, 415);
  assert.equal(typeof wrongType.json().error, 'string');
});
