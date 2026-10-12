import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { config } from './config.ts';
import { buildApp } from './app.ts';
import { Core } from './core.ts';
import { MediaMtxSupervisor, PORT_BUSY_HINT } from './mtx/supervisor.ts';
import { ModelStore } from './store/models.ts';
import { SettingsStore } from './store/settings.ts';
import { createLogger } from './util/log.ts';
import { isPortListening } from './util/net.ts';

const log = createLogger('main');

// a stray rejection must not take down the camera wall (Node exits on unhandled rejections)
process.on('unhandledRejection', (err) => {
  log.error(`Unhandled rejection: ${(err as Error)?.stack ?? String(err)}`);
});

async function main(): Promise<void> {
  log.info(`ugv-cams ${config.version} (${config.isPackaged ? 'packaged' : 'dev'})`);
  log.info(`Data dir: ${config.dataDir}`);

  await mkdir(config.runtimeDir, { recursive: true });
  const models = new ModelStore(config.modelsDir);
  await models.init();
  const settings = new SettingsStore(config.settingsFile);
  await settings.init();
  const mtx = new MediaMtxSupervisor(config.mediamtxBin, config.mtxConfigFile, config.runtimeDir);
  const core = new Core(config, models, settings, mtx);

  // config must exist before MediaMTX starts
  await core.applyActive();
  if (await isPortListening(config.http.port)) {
    log.error(
      `Port ${config.http.port} is busy — ugv-cams is probably already running (or set UGV_HTTP_PORT)`,
    );
    process.exitCode = 1;
    return;
  }
  const busy = [];
  for (const port of [config.mtx.apiPort, config.mtx.rtspPort, config.mtx.webrtcPort]) {
    if (await isPortListening(port)) busy.push(port);
  }
  if (busy.length) log.error(`Port(s) ${busy.join(', ')} already in use. ${PORT_BUSY_HINT}`);
  mtx.start();

  const app = await buildApp(core, config);
  try {
    await app.listen({ host: config.http.host, port: config.http.port });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    log.error(
      code === 'EADDRINUSE'
        ? `Port ${config.http.port} is busy — ugv-cams is probably already running (or set UGV_HTTP_PORT)`
        : `HTTP server failed: ${(err as Error).message}`,
    );
    mtx.stop();
    process.exitCode = 1;
    return;
  }

  const url = `http://localhost:${config.http.port}`;
  log.info(`UI: ${url}`);
  if (config.openBrowser && config.isWindows) {
    spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  }

  let shuttingDown = false;
  const shutdown = async (reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Shutting down (${reason})`);
    mtx.stop();
    await app.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGHUP', () => void shutdown('console closed')); // Windows: console window closed
  process.on('exit', () => mtx.stop());
}

main().catch((err) => {
  log.error((err as Error).stack ?? String(err));
  process.exit(1);
});
