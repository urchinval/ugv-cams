import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

declare const __APP_VERSION__: string | undefined;

/**
 * Directory layout.
 *
 * Packaged (release zip):            Dev (repo):
 *   ugv-cams.cmd                       bin/          (scripts/fetch-binaries.mjs)
 *   runtime/node.exe                   server/src/index.ts  <- entry
 *   app/server.cjs   <- entry          web/dist/
 *   app/web/
 *   bin/mediamtx.exe, bin/ffmpeg.exe
 *
 * User data (survives app updates — the zip folder is simply replaced):
 *   %APPDATA%\ugv-cams\models\*.json     camera models (with credentials)
 *   %APPDATA%\ugv-cams\settings.json     active model, saved layouts
 *   %APPDATA%\ugv-cams\runtime\mediamtx.yml  generated, do not edit
 */

const env = process.env;
const isWindows = process.platform === 'win32';

const entryDir = dirname(resolve(process.argv[1] ?? '.'));
const isPackaged = existsSync(join(entryDir, 'web', 'index.html'));
const repoRoot = resolve(entryDir, '..', '..');

function int(name: string, fallback: number): number {
  const v = env[name];
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const dataDir = resolve(
  env.UGV_DATA_DIR ??
    (isWindows
      ? join(env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'ugv-cams')
      : join(homedir(), '.config', 'ugv-cams')),
);

const binDir = resolve(
  env.UGV_BIN_DIR ?? (isPackaged ? join(entryDir, '..', 'bin') : join(repoRoot, 'bin')),
);
const exe = (name: string) => join(binDir, isWindows ? `${name}.exe` : name);

export const config = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
  isPackaged,
  isWindows,

  dataDir,
  modelsDir: join(dataDir, 'models'),
  settingsFile: join(dataDir, 'settings.json'),
  runtimeDir: join(dataDir, 'runtime'),
  mtxConfigFile: join(dataDir, 'runtime', 'mediamtx.yml'),

  webDir: resolve(
    env.UGV_WEB_DIR ?? (isPackaged ? join(entryDir, 'web') : join(repoRoot, 'web', 'dist')),
  ),
  mediamtxBin: resolve(env.UGV_MEDIAMTX_BIN ?? exe('mediamtx')),
  /** Bundled ffmpeg; falls back to "ffmpeg" from PATH (see mtx/ffmpeg.ts). */
  ffmpegBin: resolve(env.UGV_FFMPEG_BIN ?? exe('ffmpeg')),

  http: {
    host: env.UGV_HTTP_HOST ?? '127.0.0.1',
    port: int('UGV_HTTP_PORT', 8080),
  },
  mtx: {
    apiPort: int('UGV_MTX_API_PORT', 9997),
    rtspPort: int('UGV_MTX_RTSP_PORT', 8554),
    webrtcPort: int('UGV_MTX_WEBRTC_PORT', 8889),
    webrtcUdpPort: int('UGV_MTX_WEBRTC_UDP_PORT', 8189),
  },

  openBrowser: env.UGV_NO_BROWSER !== '1' && isPackaged,
} as const;

export type AppConfig = typeof config;
