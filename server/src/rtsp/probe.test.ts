import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import net from 'node:net';
import { parseSdpTracks, parseTarget, probeRtsp } from './probe.ts';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

const SDP_H265 = [
  'v=0',
  'o=- 0 0 IN IP4 0.0.0.0',
  's=Media Server',
  'm=video 0 RTP/AVP 98',
  'a=rtpmap:98 H265/90000',
  'a=control:trackID=0',
  'm=audio 0 RTP/AVP 8',
  'a=control:trackID=1',
  '',
].join('\r\n');

/** Fake Dahua-like camera: Digest auth, user admin / p@ss. */
function fakeCamera(sdp: string): Promise<{ port: number; close: () => void }> {
  const realm = 'Login to fake';
  const nonce = 'abc123';
  const server = net.createServer((sock) => {
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString();
      if (!buf.includes('\r\n\r\n')) return;
      const lines = buf.split('\r\n');
      const uri = lines[0]!.split(' ')[1]!;
      const auth = lines.find((l) => l.startsWith('Authorization:'));
      const expected = md5(`${md5(`admin:${realm}:p@ss`)}:${nonce}:${md5(`DESCRIBE:${uri}`)}`);
      if (!auth || !auth.includes(`response="${expected}"`) || uri.includes('@')) {
        sock.end(
          `RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm="${realm}", nonce="${nonce}"\r\nWWW-Authenticate: Basic realm="${realm}"\r\n\r\n`,
        );
      } else {
        sock.end(`RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Type: application/sdp\r\nContent-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`);
      }
      buf = '';
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ port: (server.address() as net.AddressInfo).port, close: () => server.close() }),
    ),
  );
}

test('parseTarget strips credentials, decodes percent-encoding, keeps query', () => {
  const t = parseTarget('rtsp://admin:p%40ss@192.168.18.106:554/cam/realmonitor?channel=1&subtype=1');
  assert.equal(t.user, 'admin');
  assert.equal(t.pass, 'p@ss');
  assert.equal(t.port, 554);
  assert.equal(t.uri, 'rtsp://192.168.18.106:554/cam/realmonitor?channel=1&subtype=1');
  assert.equal(parseTarget('rtsp://10.0.0.1/av0_1').port, 554);
});

test('SDP parsing incl. static payload types', () => {
  assert.deepEqual(parseSdpTracks(SDP_H265), [
    { media: 'video', codec: 'H265' },
    { media: 'audio', codec: 'PCMA' },
  ]);
});

test('digest auth -> 200, H.265 flagged for transcode', async () => {
  const cam = await fakeCamera(SDP_H265);
  try {
    const r = await probeRtsp(`rtsp://admin:p%40ss@127.0.0.1:${cam.port}/cam/realmonitor?channel=1&subtype=1`);
    assert.equal(r.error, null);
    assert.equal(r.ok, true);
    assert.equal(r.needsTranscode, true);
    assert.deepEqual(r.tracks.map((t) => t.codec), ['H265', 'PCMA']);
  } finally {
    cam.close();
  }
});

test('wrong password and missing credentials are reported', async () => {
  const cam = await fakeCamera(SDP_H265);
  try {
    const bad = await probeRtsp(`rtsp://admin:wrong@127.0.0.1:${cam.port}/x`);
    assert.equal(bad.ok, false);
    assert.equal(bad.status, 401);
    assert.match(bad.error!, /логін або пароль/);
    const none = await probeRtsp(`rtsp://127.0.0.1:${cam.port}/x`);
    assert.match(none.error!, /вимагає логін/);
  } finally {
    cam.close();
  }
});

test('closed port -> readable error', async () => {
  const srv = net.createServer();
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const port = (srv.address() as net.AddressInfo).port;
  await new Promise<void>((r) => srv.close(() => r()));
  const r = await probeRtsp(`rtsp://127.0.0.1:${port}/x`);
  assert.equal(r.ok, false);
  assert.match(r.error!, /відхилено/);
});
