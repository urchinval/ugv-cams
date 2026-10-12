import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import type { Model } from '@ugv/shared';
import { renderMediamtxConfig } from './render.ts';

const opts = { apiPort: 9997, rtspPort: 8554, webrtcPort: 8889, webrtcUdpPort: 8189, ffmpeg: "'C:/app/bin/ffmpeg.exe'" };

const model: Model = {
  id: 'abc123',
  name: 'Lynx 2407',
  updatedAt: '2026-10-12T00:00:00Z',
  cameras: [
    {
      id: 'front',
      label: 'Front',
      transcode: false,
      streams: {
        sub: 'rtsp://u:p@192.168.18.106:554/cam/realmonitor?channel=1&subtype=1',
        main: 'rtsp://u:p@192.168.18.106:554/cam/realmonitor?channel=1&subtype=0',
        third: null,
      },
    },
    {
      id: 'thermal',
      label: 'Thermal',
      transcode: true,
      streams: { sub: 'rtsp://192.168.18.110:554/av0_1', main: null, third: null },
    },
  ],
};

test('renders one on-demand path per configured stream', () => {
  const conf = parse(renderMediamtxConfig(model, opts));
  assert.deepEqual(Object.keys(conf.paths).sort(), ['front_main', 'front_sub', 'thermal_sub', 'thermal_sub_src']);
  assert.equal(conf.paths.front_sub.source, model.cameras[0]!.streams.sub);
  assert.equal(conf.paths.front_sub.sourceOnDemand, true);
  // query string must survive YAML serialization intact
  assert.match(conf.paths.front_main.source, /channel=1&subtype=0$/);
});

test('transcoded camera: raw _src path + ffmpeg publisher without sourceOnDemand', () => {
  const conf = parse(renderMediamtxConfig(model, opts));
  assert.equal(conf.paths.thermal_sub_src.source, 'rtsp://192.168.18.110:554/av0_1');
  const out = conf.paths.thermal_sub;
  assert.equal(out.source, undefined);
  assert.equal(out.sourceOnDemand, undefined, 'MediaMTX rejects sourceOnDemand on publisher paths');
  assert.ok(out.runOnDemand.startsWith("'C:/app/bin/ffmpeg.exe' "));
  assert.match(out.runOnDemand, /rtsp:\/\/127\.0\.0\.1:\$RTSP_PORT\/thermal_sub_src/);
  assert.match(out.runOnDemand, /\$MTX_PATH$/);
});

test('pathDefaults has no sourceOnDemand (regression)', () => {
  const conf = parse(renderMediamtxConfig(model, opts));
  assert.deepEqual(conf.pathDefaults, { rtspTransport: 'tcp' });
});

test('no model -> valid config with empty paths', () => {
  const conf = parse(renderMediamtxConfig(null, opts));
  assert.deepEqual(conf.paths, {});
  assert.equal(conf.webrtcAddress, ':8889');
  assert.equal(conf.apiAddress, '127.0.0.1:9997');
});
