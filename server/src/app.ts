import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { API_PREFIX } from '@ugv/shared';
import type { AppConfig } from './config.ts';
import type { Core } from './core.ts';
import { registerRoutes } from './api/routes.ts';

/** HTTP app: JSON API under /api, React build as static SPA. Separate from index.ts for tests. */
export async function buildApp(core: Core, cfg: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: 'warn' },
    bodyLimit: 1024 * 1024,
  });

  registerRoutes(app, core, cfg);

  if (existsSync(join(cfg.webDir, 'index.html'))) {
    // wildcard (default): files are resolved per request, so a rebuilt UI is served without a restart
    await app.register(fastifyStatic, { root: cfg.webDir });
    // SPA fallback: anything that is not /api and not an existing file -> index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith(`${API_PREFIX}/`)) return reply.code(404).send({ error: 'Not found' });
      return reply.sendFile('index.html');
    });
  } else {
    app.get('/', async () => ({
      message: `UI build not found in ${cfg.webDir}. In dev run "npm run dev:web" and open the Vite URL.`,
    }));
  }

  return app;
}
