import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { writeFileAtomic } from '../util/fs.ts';
import { createLogger } from '../util/log.ts';

const log = createLogger('mediamtx');

const BACKOFF_MS = [1000, 2000, 5000, 10000];
const STABLE_AFTER_MS = 30_000;

/** Go "address already in use" on Linux / WSAEADDRINUSE text on Windows. */
const PORT_BUSY_RE = /address already in use|only one usage of each socket address/i;
export const PORT_BUSY_HINT =
  'MediaMTX port is busy — another mediamtx.exe is probably still running ' +
  '(old start-mediamtx.cmd or a crashed ugv-cams). Close it: taskkill /IM mediamtx.exe /F';

/**
 * Owns the MediaMTX child process.
 * Config changes are applied by rewriting the yml — MediaMTX hot-reloads it and only
 * restarts the paths that changed, so a model switch does not drop the RTSP/WebRTC servers.
 */
export class MediaMtxSupervisor {
  private child: ChildProcess | null = null;
  private stopping = false;
  private restarts = 0;
  private attempt = 0;
  private startedAt = 0;
  private restartTimer: NodeJS.Timeout | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly bin: string,
    private readonly configFile: string,
    private readonly cwd: string,
  ) {}

  async writeConfig(yml: string): Promise<void> {
    await writeFileAtomic(this.configFile, yml);
  }

  start(): void {
    this.stopping = false;
    if (!existsSync(this.bin)) {
      this.lastError = `MediaMTX not found: ${this.bin}`;
      log.error(this.lastError);
      return;
    }

    log.info(`Starting ${this.bin}`);
    const child = spawn(this.bin, [this.configFile], {
      cwd: this.cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child = child;
    this.startedAt = Date.now();
    this.lastError = null;
    let portHintShown = false;

    const pipe = (stream: NodeJS.ReadableStream | null) => {
      if (!stream) return;
      createInterface({ input: stream }).on('line', (line) => {
        console.log(`  mtx | ${line}`);
        if (!/\bERR\b/.test(line)) return;
        this.lastError = line;
        if (!portHintShown && PORT_BUSY_RE.test(line)) {
          portHintShown = true;
          log.error(PORT_BUSY_HINT);
        }
      });
    };
    pipe(child.stdout);
    pipe(child.stderr);

    child.on('error', (err) => {
      // spawn failure: 'exit' may never follow, so do not keep reporting the process as running
      if (this.child === child && child.pid === undefined) this.child = null;
      this.lastError = `Failed to start MediaMTX: ${err.message}`;
      log.error(this.lastError);
    });

    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null;
      if (this.stopping) return;
      if (Date.now() - this.startedAt > STABLE_AFTER_MS) this.attempt = 0;
      const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
      this.attempt++;
      this.restarts++;
      log.warn(`MediaMTX exited (code=${code ?? '-'} signal=${signal ?? '-'}), restarting in ${delay} ms`);
      this.restartTimer = setTimeout(() => this.start(), delay);
    });
  }

  stop(): void {
    if (this.stopping) return;
    this.stopping = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.child && this.child.exitCode === null) {
      log.info('Stopping MediaMTX');
      this.child.kill();
    }
  }

  status() {
    return {
      running: this.child !== null && this.child.exitCode === null,
      pid: this.child?.pid ?? null,
      restarts: this.restarts,
      lastError: this.lastError,
    };
  }
}
