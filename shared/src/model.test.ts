import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelInputSchema, availableStreams, suggestCameraId } from './model.ts';

const url = 'rtsp://admin:p%40ss@192.168.18.106:554/cam/realmonitor?channel=1&subtype=1';

test('empty optional streams become null, sub is required', () => {
  const m = ModelInputSchema.parse({
    name: 'Lynx 2407',
    cameras: [{ id: 'front', label: 'Front', streams: { sub: url, main: '', third: undefined } }],
  });
  assert.equal(m.cameras[0]!.streams.main, null);
  assert.equal(m.cameras[0]!.streams.third, null);
  assert.equal(m.cameras[0]!.transcode, false);
  assert.deepEqual(availableStreams(m.cameras[0]!), ['sub']);

  const bad = ModelInputSchema.safeParse({
    name: 'x',
    cameras: [{ id: 'front', label: 'Front', streams: { sub: '' } }],
  });
  assert.equal(bad.success, false);
});

test('duplicate camera ids are rejected', () => {
  const cam = { id: 'front', label: 'F', streams: { sub: url } };
  const r = ModelInputSchema.safeParse({ name: 'x', cameras: [cam, cam] });
  assert.equal(r.success, false);
});

test('suggestCameraId produces unique safe ids', () => {
  assert.equal(suggestCameraId('Front Cam'), 'front_cam');
  assert.equal(suggestCameraId('Термалка'), 'cam');
  assert.equal(suggestCameraId('Front', ['front']), 'front_2');
});
