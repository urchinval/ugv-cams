import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VideoStatsSampler, type StatsReportLike } from './videoStats.ts';

type Raw = Record<string, unknown>;

/** getStats()-like report with one H264 video receiver. */
function report(inbound: Raw): StatsReportLike {
  return new Map<string, { type: string; id?: string } & Raw>([
    ['c1', { type: 'codec', id: 'c1', mimeType: 'video/H264' }],
    ['in', { type: 'inbound-rtp', kind: 'video', codecId: 'c1', ...inbound }],
  ]);
}

test('no video receiver yet -> null', () => {
  const s = new VideoStatsSampler();
  assert.equal(s.sample(new Map(), 0), null);
});

test('first sample has totals but no per-interval rates', () => {
  const s = new VideoStatsSampler();
  const r = s.sample(
    report({
      framesDecoded: 10,
      bytesReceived: 1000,
      packetsLost: 3,
      frameWidth: 1280,
      frameHeight: 720,
    }),
    0,
  )!;
  assert.equal(r.codec, 'H264');
  assert.equal(r.width, 1280);
  assert.equal(r.framesDecoded, 10);
  assert.equal(r.packetsLost, 3);
  assert.equal(r.kbps, null);
  assert.equal(r.lossPct, null);
});

test('rates come from deltas between samples', () => {
  const s = new VideoStatsSampler();
  s.sample(
    report({
      framesDecoded: 0,
      bytesReceived: 0,
      packetsReceived: 0,
      packetsLost: 0,
      jitterBufferDelay: 0,
      jitterBufferEmittedCount: 0,
    }),
    0,
  );
  const r = s.sample(
    report({
      framesDecoded: 15,
      bytesReceived: 125_000, // 1 Mbit in 1 s
      packetsReceived: 99,
      packetsLost: 1,
      jitterBufferDelay: 1.5, // 1.5 s total over 15 frames = 100 ms each
      jitterBufferEmittedCount: 15,
    }),
    1000,
  )!;
  assert.equal(r.kbps, 1000);
  assert.equal(r.lossPct, 1);
  assert.equal(r.fps, 15, 'falls back to decoded frames / s without framesPerSecond');
  assert.ok(Math.abs(r.jitterBufferMs! - 100) < 1e-9);
});

test('time since key frame resets when a new key frame is decoded', () => {
  const s = new VideoStatsSampler();
  assert.equal(s.sample(report({ keyFramesDecoded: 0 }), 0)!.sinceKeyframeSec, null);
  s.sample(report({ keyFramesDecoded: 1 }), 1000);
  assert.equal(s.sample(report({ keyFramesDecoded: 1 }), 3500)!.sinceKeyframeSec, 2.5);
  assert.equal(s.sample(report({ keyFramesDecoded: 2 }), 4000)!.sinceKeyframeSec, 0);
});
