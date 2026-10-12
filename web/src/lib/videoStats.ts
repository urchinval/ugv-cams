/**
 * Debug numbers for one WebRTC video receiver, computed from successive getStats() reports.
 * Cumulative counters (bytes, lost packets, jitter buffer) are turned into per-interval rates.
 * Field names follow the W3C webrtc-stats spec; some are Chrome-only, so all are optional.
 */

export interface VideoStats {
  /** cumulative, drives the watchdog */
  framesDecoded: number;
  codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  kbps: number | null;
  /** lost / (lost + received) over the last interval, % */
  lossPct: number | null;
  /** totals for the current session (reset on reconnect) */
  packetsLost: number;
  framesDropped: number;
  freezes: number;
  freezeSec: number;
  nacks: number;
  plis: number;
  jitterMs: number | null;
  /** average time a frame waited in the jitter buffer over the last interval */
  jitterBufferMs: number | null;
  /** time since the last decoded key frame ≈ how long artifacts can last (camera GOP) */
  sinceKeyframeSec: number | null;
}

interface InboundVideo {
  type: 'inbound-rtp';
  kind: string;
  codecId?: string;
  framesDecoded?: number;
  framesPerSecond?: number;
  frameWidth?: number;
  frameHeight?: number;
  bytesReceived?: number;
  packetsReceived?: number;
  packetsLost?: number;
  framesDropped?: number;
  freezeCount?: number;
  totalFreezesDuration?: number;
  nackCount?: number;
  pliCount?: number;
  jitter?: number;
  jitterBufferDelay?: number;
  jitterBufferEmittedCount?: number;
  keyFramesDecoded?: number;
}

/** What RTCStatsReport offers; a Map of plain objects in tests. */
export interface StatsReportLike {
  forEach(cb: (s: { type: string; id?: string } & Record<string, unknown>) => void): void;
}

interface Sample {
  t: number;
  decoded: number;
  bytes: number;
  lost: number;
  received: number;
  jbDelay: number;
  jbCount: number;
}

export class VideoStatsSampler {
  private prev: Sample | null = null;
  private keyFrames = 0;
  private lastKeyframeAt: number | null = null;

  /** `t` in ms (performance.now()). Returns null until the video receiver shows up. */
  sample(report: StatsReportLike, t: number): VideoStats | null {
    let inbound: InboundVideo | undefined;
    const codecs = new Map<string, string>();
    report.forEach((s) => {
      if (s.type === 'inbound-rtp' && s.kind === 'video') inbound = s as unknown as InboundVideo;
      if (s.type === 'codec' && s.id && typeof s.mimeType === 'string') {
        codecs.set(s.id, s.mimeType.replace(/^video\//i, ''));
      }
    });
    if (!inbound) return null;
    const v = inbound;

    const cur: Sample = {
      t,
      decoded: v.framesDecoded ?? 0,
      bytes: v.bytesReceived ?? 0,
      lost: Math.max(0, v.packetsLost ?? 0),
      received: v.packetsReceived ?? 0,
      jbDelay: v.jitterBufferDelay ?? 0,
      jbCount: v.jitterBufferEmittedCount ?? 0,
    };
    const p = this.prev;
    const dt = p ? (cur.t - p.t) / 1000 : 0;

    const keyFrames = v.keyFramesDecoded ?? 0;
    if (keyFrames > this.keyFrames) this.lastKeyframeAt = t;
    this.keyFrames = keyFrames;

    let kbps: number | null = null;
    let lossPct: number | null = null;
    let jitterBufferMs: number | null = null;
    if (p && dt > 0) {
      kbps = ((cur.bytes - p.bytes) * 8) / 1000 / dt;
      const lost = cur.lost - p.lost;
      const total = lost + (cur.received - p.received);
      lossPct = total > 0 ? (lost / total) * 100 : 0;
      const emitted = cur.jbCount - p.jbCount;
      jitterBufferMs = emitted > 0 ? ((cur.jbDelay - p.jbDelay) / emitted) * 1000 : null;
    }
    this.prev = cur;

    const fps = v.framesPerSecond ?? (p && dt > 0 ? (cur.decoded - p.decoded) / dt : null);

    return {
      framesDecoded: cur.decoded,
      codec: (v.codecId && codecs.get(v.codecId)) ?? null,
      width: v.frameWidth ?? null,
      height: v.frameHeight ?? null,
      fps,
      kbps,
      lossPct,
      packetsLost: cur.lost,
      framesDropped: v.framesDropped ?? 0,
      freezes: v.freezeCount ?? 0,
      freezeSec: v.totalFreezesDuration ?? 0,
      nacks: v.nackCount ?? 0,
      plis: v.pliCount ?? 0,
      jitterMs: v.jitter !== undefined ? v.jitter * 1000 : null,
      jitterBufferMs,
      sinceKeyframeSec: this.lastKeyframeAt === null ? null : (t - this.lastKeyframeAt) / 1000,
    };
  }
}
