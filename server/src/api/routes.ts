import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import {
  API_ROUTES,
  LayoutSchema,
  MODEL_FILE_EXT,
  MODEL_FILE_FORMAT,
  MODEL_FILE_VERSION,
  ModelIdSchema,
  type ActiveResponse,
  type ApiError,
  type LayoutResponse,
  type ModelFile,
  type ModelSummary,
  type ServerInfo,
  type StatusResponse,
} from '@ugv/shared';
import type { AppConfig } from '../config.ts';
import type { Core } from '../core.ts';
import { fetchPathStatuses } from '../mtx/client.ts';
import { NotFoundError } from '../store/models.ts';

const IdParams = z.object({ id: ModelIdSchema });
const SelectBody = z.object({ modelId: ModelIdSchema.nullable() });
const LayoutBody = z.object({ layout: LayoutSchema.nullable() });

export function registerRoutes(app: FastifyInstance, core: Core, cfg: AppConfig): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      const body: ApiError = {
        error: 'Помилка валідації',
        issues: err.issues.map((i) => ({
          path: i.path as (string | number)[],
          message: i.message,
        })),
      };
      return reply.code(400).send(body);
    }
    if (err instanceof NotFoundError)
      return reply.code(404).send({ error: err.message } satisfies ApiError);
    // client errors from our code or Fastify itself (bad JSON, 415, body too large, ...)
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: (err as Error).message } satisfies ApiError);
    }
    app.log.error(err);
    return reply.code(500).send({ error: (err as Error).message } satisfies ApiError);
  });

  app.get(API_ROUTES.info, async (): Promise<ServerInfo> => ({
    version: cfg.version,
    webrtcPort: cfg.mtx.webrtcPort,
    rtspPort: cfg.mtx.rtspPort,
    dataDir: cfg.dataDir,
    ffmpegFound: core.ffmpegFound,
  }));

  // ---- models ----
  app.get(API_ROUTES.models, async (): Promise<ModelSummary[]> => core.models.list());

  app.get(API_ROUTES.model, async (req) => core.models.get(IdParams.parse(req.params).id));

  app.post(API_ROUTES.models, async (req, reply) =>
    reply.code(201).send(await core.models.create(req.body)),
  );

  app.put(API_ROUTES.model, async (req) =>
    core.updateModel(IdParams.parse(req.params).id, req.body),
  );

  app.delete(API_ROUTES.model, async (req, reply) => {
    await core.deleteModel(IdParams.parse(req.params).id);
    return reply.code(204).send();
  });

  /** Exported file, see shared/model-file.ts. Contains credentials. */
  app.get(API_ROUTES.modelExport, async (req, reply) => {
    const m = await core.models.get(IdParams.parse(req.params).id);
    const safeName = m.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'model';
    const file: ModelFile = {
      format: MODEL_FILE_FORMAT,
      version: MODEL_FILE_VERSION,
      name: m.name,
      cameras: m.cameras,
    };
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}${MODEL_FILE_EXT}`)}`,
      )
      .send(JSON.stringify(file, null, 2));
  });

  app.post(API_ROUTES.modelImport, async (req, reply) =>
    reply.code(201).send(await core.models.import(req.body)),
  );

  // ---- active model ----
  app.get(API_ROUTES.active, async (): Promise<ActiveResponse> => ({
    model: await core.activeModel(),
  }));

  app.put(API_ROUTES.active, async (req): Promise<ActiveResponse> => ({
    model: await core.selectModel(SelectBody.parse(req.body).modelId),
  }));

  // ---- layouts (per model) ----
  app.get(API_ROUTES.modelLayout, async (req): Promise<LayoutResponse> => ({
    layout: await core.getLayout(IdParams.parse(req.params).id),
  }));

  /** { layout: null } resets to the generic auto layout. */
  app.put(API_ROUTES.modelLayout, async (req): Promise<LayoutResponse> => ({
    layout: await core.setLayout(IdParams.parse(req.params).id, LayoutBody.parse(req.body).layout),
  }));

  // ---- status ----
  app.get(API_ROUTES.status, async (): Promise<StatusResponse> => {
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
}
