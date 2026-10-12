import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import {
  LayoutSchema,
  ModelIdSchema,
  type ActiveResponse,
  type ApiError,
  type LayoutResponse,
  type ModelSummary,
  type ProbeResult,
  type ServerInfo,
  type StatusResponse,
} from '@ugv/shared';
import type { AppConfig } from '../config.ts';
import type { Core } from '../core.ts';
import { fetchPathStatuses } from '../mtx/client.ts';
import { probeRtsp } from '../rtsp/probe.ts';
import { NotFoundError } from '../store/models.ts';

const IdParams = z.object({ id: ModelIdSchema });
const SelectBody = z.object({ modelId: ModelIdSchema.nullable() });
const LayoutBody = z.object({ layout: LayoutSchema.nullable() });
const ProbeBody = z.object({ url: z.string().min(1) });

export function registerRoutes(app: FastifyInstance, core: Core, cfg: AppConfig): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      const body: ApiError = {
        error: 'Помилка валідації',
        issues: err.issues.map((i) => ({ path: i.path as (string | number)[], message: i.message })),
      };
      return reply.code(400).send(body);
    }
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message } satisfies ApiError);
    // client errors from our code or Fastify itself (bad JSON, 415, body too large, ...)
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: (err as Error).message } satisfies ApiError);
    }
    app.log.error(err);
    return reply.code(500).send({ error: (err as Error).message } satisfies ApiError);
  });

  app.get('/api/info', async (): Promise<ServerInfo> => ({
    version: cfg.version,
    webrtcPort: cfg.mtx.webrtcPort,
    rtspPort: cfg.mtx.rtspPort,
    dataDir: cfg.dataDir,
    ffmpegFound: core.ffmpegFound,
  }));

  // ---- models ----
  app.get('/api/models', async (): Promise<ModelSummary[]> => core.models.list());

  app.get('/api/models/:id', async (req) => core.models.get(IdParams.parse(req.params).id));

  app.post('/api/models', async (req, reply) => reply.code(201).send(await core.models.create(req.body)));

  app.put('/api/models/:id', async (req) => core.updateModel(IdParams.parse(req.params).id, req.body));

  app.delete('/api/models/:id', async (req, reply) => {
    await core.deleteModel(IdParams.parse(req.params).id);
    return reply.code(204).send();
  });

  /** Exported file: name + cameras only (id is regenerated on import). Contains credentials. */
  app.get('/api/models/:id/export', async (req, reply) => {
    const m = await core.models.get(IdParams.parse(req.params).id);
    const safeName = m.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'model';
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}.ugvcam.json`)}`)
      .send(JSON.stringify({ format: 'ugv-cams-model', version: 1, name: m.name, cameras: m.cameras }, null, 2));
  });

  app.post('/api/models/import', async (req, reply) => reply.code(201).send(await core.models.import(req.body)));

  // ---- active model ----
  app.get('/api/active', async (): Promise<ActiveResponse> => ({ model: await core.activeModel() }));

  app.put('/api/active', async (req): Promise<ActiveResponse> => ({
    model: await core.selectModel(SelectBody.parse(req.body).modelId),
  }));

  // ---- layouts (per model) ----
  app.get('/api/models/:id/layout', async (req): Promise<LayoutResponse> => ({
    layout: await core.getLayout(IdParams.parse(req.params).id),
  }));

  /** { layout: null } resets to the generic auto layout. */
  app.put('/api/models/:id/layout', async (req): Promise<LayoutResponse> => ({
    layout: await core.setLayout(IdParams.parse(req.params).id, LayoutBody.parse(req.body).layout),
  }));

  // ---- status / probe ----
  app.get('/api/status', async (): Promise<StatusResponse> => {
    const mediamtx = core.mtx.status();
    let paths: StatusResponse['paths'] = {};
    if (mediamtx.running) {
      try {
        paths = await fetchPathStatuses(cfg.mtx.apiPort);
      } catch {
        /* API not up yet right after start — report empty paths */
      }
    }
    return { mediamtx, paths };
  });

  app.post('/api/probe', async (req): Promise<ProbeResult> => probeRtsp(ProbeBody.parse(req.body).url));
}
