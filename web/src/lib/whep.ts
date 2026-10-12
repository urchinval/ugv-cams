/**
 * Minimal WHEP reader for MediaMTX.
 *
 * - video only (recvonly) — audio is never played on the camera wall, so it is not negotiated
 *   and MediaMTX does not send it over Starlink;
 * - non-trickle: waits for local ICE gathering, then POSTs the full offer. Avoids the
 *   PATCH/ICE-trickle round trips (and the 405 pitfalls seen behind proxies);
 * - reconnects on failure with backoff;
 * - watchdog from the moment the answer is applied: no first frame within 10 s (ICE stuck in
 *   'new'/'checking' never reaches 'failed' on its own) or no new frames for 6 s -> reconnect.
 */

import { playPath, type StreamKind } from '@ugv/shared';

export type WhepState = 'connecting' | 'playing' | 'retrying' | 'closed';

/** MediaMTX WHEP endpoint of a camera stream. `nonce` forces a new URL (manual reconnect). */
export function whepUrl(base: string, cameraId: string, stream: StreamKind, nonce = 0): string {
  return `${base}/${playPath(cameraId, stream)}/whep${nonce ? `?r=${nonce}` : ''}`;
}

export interface WhepCallbacks {
  onTrack: (stream: MediaStream) => void;
  onState: (state: WhepState, detail?: string) => void;
}

const BACKOFF_MS = [1000, 2000, 3000, 5000];
const ICE_GATHER_TIMEOUT_MS = 2000;
/** Longer than runOnDemandStartTimeout (20 s), so MediaMTX's own "no stream" answer comes first. */
const WHEP_REQUEST_TIMEOUT_MS = 25_000;
const WATCHDOG_TICK_MS = 2000;
const FIRST_FRAME_TIMEOUT_MS = 10_000;
const STALL_AFTER_MS = 6000;
const DISCONNECT_GRACE_MS = 3000;

export class WhepReader {
  private pc: RTCPeerConnection | null = null;
  private sessionUrl: string | null = null;
  private closed = false;
  private attempt = 0;
  private retryTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private abort: AbortController | null = null;
  /** Network came back (Wi-Fi / Starlink link up): do not sit out the rest of the backoff. */
  private readonly onOnline = () => {
    if (this.closed || this.retryTimer === null) return;
    window.clearTimeout(this.retryTimer);
    this.retryTimer = null;
    void this.connect();
  };

  constructor(
    private readonly url: string,
    private readonly cb: WhepCallbacks,
  ) {
    window.addEventListener('online', this.onOnline);
    void this.connect();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener('online', this.onOnline);
    this.teardown();
    this.cb.onState('closed');
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    this.cb.onState(this.attempt === 0 ? 'connecting' : 'retrying');

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    pc.addTransceiver('video', { direction: 'recvonly' });

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      this.cb.onTrack(stream);
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === 'connected') {
        this.attempt = 0;
        this.cb.onState('playing');
      } else if (pc.connectionState === 'failed') {
        this.scheduleRetry('зʼєднання втрачено');
      } else if (pc.connectionState === 'disconnected') {
        // ICE often recovers by itself after a short Starlink dropout; give it a moment
        window.setTimeout(() => {
          if (this.pc === pc && pc.connectionState === 'disconnected')
            this.scheduleRetry('зʼєднання перервано');
        }, DISCONNECT_GRACE_MS);
      }
    };

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitIceGathering(pc);
      if (this.pc !== pc) return;

      const abort = new AbortController();
      this.abort = abort;
      const timeout = window.setTimeout(
        () => abort.abort(new Error('MediaMTX не відповідає (таймаут)')),
        WHEP_REQUEST_TIMEOUT_MS,
      );
      let answer: string;
      try {
        const res = await fetch(this.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription!.sdp,
          signal: abort.signal,
        });
        if (res.status !== 201) {
          const text = await res.text().catch(() => '');
          throw new Error(describeHttpError(res.status, text));
        }
        const loc = res.headers.get('Location');
        this.sessionUrl = loc ? new URL(loc, this.url).toString() : null;
        answer = await res.text();
      } finally {
        window.clearTimeout(timeout);
      }
      if (this.pc !== pc) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      this.startWatchdog(pc);
    } catch (err) {
      if (this.closed || this.pc !== pc) return;
      // fetch() rejects with TypeError when nothing listens on the WHEP port
      this.scheduleRetry(
        err instanceof TypeError ? 'MediaMTX не відповідає' : (err as Error).message,
      );
    }
  }

  /**
   * Judges the session by decoded frames only, whatever connectionState says: covers ICE that
   * never connects, a frozen picture (Starlink hiccup, camera reboot) and a session MediaMTX
   * closed while the browser still reports 'connected'.
   */
  private startWatchdog(pc: RTCPeerConnection): void {
    this.stopWatchdog();
    let frames = 0;
    let lastChange = performance.now();
    this.watchdogTimer = window.setInterval(async () => {
      if (this.pc !== pc) return;
      let decoded = 0;
      try {
        const stats = await pc.getStats();
        stats.forEach((s) => {
          if (s.type === 'inbound-rtp' && s.kind === 'video')
            decoded = (s as { framesDecoded?: number }).framesDecoded ?? 0;
        });
      } catch {
        /* closed mid-call: counts as no progress */
      }
      if (this.pc !== pc) return;
      const t = performance.now();
      if (decoded > frames) {
        frames = decoded;
        lastChange = t;
      } else if (frames === 0 && t - lastChange > FIRST_FRAME_TIMEOUT_MS) {
        this.scheduleRetry(
          pc.connectionState === 'connected' ? 'немає відео від камери' : 'WebRTC не зʼєднується',
        );
      } else if (frames > 0 && t - lastChange > STALL_AFTER_MS) {
        this.scheduleRetry('немає нових кадрів');
      }
    }, WATCHDOG_TICK_MS);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer !== null) window.clearInterval(this.watchdogTimer);
    this.watchdogTimer = null;
  }

  private scheduleRetry(reason: string): void {
    if (this.closed || this.retryTimer !== null) return;
    this.teardown();
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
    this.attempt++;
    this.cb.onState('retrying', reason);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private teardown(): void {
    this.stopWatchdog();
    if (this.retryTimer !== null && this.closed) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.abort?.abort();
    this.abort = null;
    if (this.sessionUrl) {
      // free the MediaMTX session right away instead of waiting for its timeout
      fetch(this.sessionUrl, { method: 'DELETE' }).catch(() => {});
      this.sessionUrl = null;
    }
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
  }
}

function waitIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    // host candidates appear within ms on a LAN; never wait long for gathering to "complete"
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

function describeHttpError(status: number, body: string): string {
  // our paths are always in the generated yml, so this means another MediaMTX owns the port
  if (/not configured/i.test(body))
    return 'MediaMTX не знає цей потік: схоже, запущено інший mediamtx.exe';
  // on-demand source did not come up in time: camera unreachable over the link
  if (status === 404) return 'камера не відповідає (немає звʼязку з машиною?)';
  if (status === 400 && /codecs not supported/i.test(body))
    return 'кодек не підтримується браузером (потрібен транскод)';
  const short = body.replace(/\s+/g, ' ').trim().slice(0, 120);
  return `MediaMTX ${status}${short ? `: ${short}` : ''}`;
}
