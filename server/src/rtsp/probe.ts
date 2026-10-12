import { createHash, randomBytes } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import type { ProbeResult, ProbeTrack } from '@ugv/shared';

/**
 * "Перевірити" button: one RTSP DESCRIBE (with Basic/Digest auth retry) straight from Node.
 * Tells the editor whether the camera answers, whether credentials are right and which
 * codecs it sends — so H.265 is caught while creating the model, not on the operator's screen.
 */

const TIMEOUT_MS = 6000;
const USER_AGENT = 'ugv-cams-probe';
/** Codecs browsers can decode over WebRTC without transcoding (H.265 support is not reliable). */
const WEBRTC_VIDEO_OK = new Set(['H264', 'VP8', 'VP9', 'AV1']);
/** RFC 3551 static payload types that may appear without an rtpmap line. */
const STATIC_PT: Record<string, string> = { '0': 'PCMU', '8': 'PCMA', '14': 'MPA', '26': 'JPEG', '32': 'MPV' };

interface Target {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  /** request URI without credentials */
  uri: string;
}

interface RtspResponse {
  status: number;
  headers: Map<string, string[]>;
  body: string;
}

export class ProbeError extends Error {}

export function parseTarget(url: string): Target {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new ProbeError('Некоректний URL');
  }
  const secure = u.protocol === 'rtsps:';
  if (u.protocol !== 'rtsp:' && !secure) throw new ProbeError('URL має починатися з rtsp://');
  return {
    host: u.hostname.replace(/^\[|\]$/g, ''),
    port: u.port ? Number(u.port) : secure ? 322 : 554,
    secure,
    user: decodeURIComponent(u.username),
    pass: decodeURIComponent(u.password),
    uri: `${u.protocol}//${u.host}${u.pathname}${u.search}`,
  };
}

function rtspRequest(t: Target, extraHeaders: string[], deadline: number): Promise<RtspResponse> {
  return new Promise((resolve, reject) => {
    const remaining = Math.max(500, deadline - Date.now());
    const socket = t.secure
      ? tls.connect({ host: t.host, port: t.port, rejectUnauthorized: false })
      : net.connect({ host: t.host, port: t.port });
    let buf = Buffer.alloc(0);
    let done = false;

    const finish = (err: Error | null, res?: RtspResponse) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(res!);
    };
    const timer = setTimeout(() => finish(new ProbeError('Немає відповіді: камера недоступна або немає маршруту')), remaining);

    socket.once(t.secure ? 'secureConnect' : 'connect', () => {
      const req = [
        `DESCRIBE ${t.uri} RTSP/1.0`,
        'CSeq: 1',
        `User-Agent: ${USER_AGENT}`,
        'Accept: application/sdp',
        ...extraHeaders,
        '',
        '',
      ].join('\r\n');
      socket.write(req);
    });

    socket.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd < 0) {
        if (buf.length > 64 * 1024) finish(new ProbeError('Некоректна відповідь RTSP'));
        return;
      }
      const head = buf.subarray(0, headerEnd).toString('latin1').split('\r\n');
      const m = /^RTSP\/1\.\d (\d{3})/.exec(head[0] ?? '');
      if (!m) return finish(new ProbeError('Відповідь не схожа на RTSP (неправильний порт?)'));
      const headers = new Map<string, string[]>();
      for (const line of head.slice(1)) {
        const i = line.indexOf(':');
        if (i < 0) continue;
        const k = line.slice(0, i).trim().toLowerCase();
        headers.set(k, [...(headers.get(k) ?? []), line.slice(i + 1).trim()]);
      }
      const len = Number(headers.get('content-length')?.[0] ?? 0);
      const body = buf.subarray(headerEnd + 4);
      if (body.length < len) return; // wait for the rest of the SDP
      finish(null, { status: Number(m[1]), headers, body: body.subarray(0, len).toString('utf8') });
    });

    socket.on('error', (err: NodeJS.ErrnoException) => {
      const msg: Record<string, string> = {
        ECONNREFUSED: "З'єднання відхилено: RTSP-порт закритий",
        EHOSTUNREACH: 'Хост недоступний: немає маршруту (тунель?)',
        ENETUNREACH: 'Мережа недоступна: немає маршруту (тунель?)',
        ETIMEDOUT: 'Немає відповіді: камера недоступна або немає маршруту',
        ECONNRESET: "Камера розірвала з'єднання",
      };
      finish(new ProbeError(msg[err.code ?? ''] ?? `Помилка мережі: ${err.message}`));
    });
  });
}

function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

function parseAuthParams(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const m of header.matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g)) {
    params[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? '';
  }
  return params;
}

/** Builds Authorization from WWW-Authenticate challenges (Digest preferred over Basic). */
export function buildAuthorization(challenges: string[], t: Target, method = 'DESCRIBE'): string | null {
  const digest = challenges.find((c) => /^digest\s/i.test(c));
  if (digest) {
    const p = parseAuthParams(digest);
    const realm = p.realm ?? '';
    const nonce = p.nonce ?? '';
    const ha1 = md5(`${t.user}:${realm}:${t.pass}`);
    const ha2 = md5(`${method}:${t.uri}`);
    const fields = [
      `username="${t.user}"`,
      `realm="${realm}"`,
      `nonce="${nonce}"`,
      `uri="${t.uri}"`,
    ];
    const qopAuth = p.qop?.split(',').map((s) => s.trim()).includes('auth');
    if (qopAuth) {
      const nc = '00000001';
      const cnonce = randomBytes(8).toString('hex');
      fields.push(`response="${md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`)}"`, 'qop=auth', `nc=${nc}`, `cnonce="${cnonce}"`);
    } else {
      fields.push(`response="${md5(`${ha1}:${nonce}:${ha2}`)}"`);
    }
    if (p.opaque) fields.push(`opaque="${p.opaque}"`);
    if (p.algorithm) fields.push(`algorithm=${p.algorithm}`);
    return `Digest ${fields.join(', ')}`;
  }
  if (challenges.some((c) => /^basic\b/i.test(c))) {
    return `Basic ${Buffer.from(`${t.user}:${t.pass}`).toString('base64')}`;
  }
  return null;
}

export function parseSdpTracks(sdp: string): ProbeTrack[] {
  const tracks: { media: string; pts: string[]; rtpmap: Record<string, string> }[] = [];
  for (const raw of sdp.split(/\r?\n/)) {
    const line = raw.trim();
    const media = /^m=(\w+)\s+\S+\s+\S+\s+(.*)$/.exec(line);
    if (media) {
      tracks.push({ media: media[1]!, pts: media[2]!.split(/\s+/), rtpmap: {} });
      continue;
    }
    const map = /^a=rtpmap:(\d+)\s+([^/\s]+)/.exec(line);
    if (map && tracks.length) tracks[tracks.length - 1]!.rtpmap[map[1]!] = map[2]!.toUpperCase();
  }
  return tracks.map((t) => {
    const pt = t.pts[0] ?? '';
    return { media: t.media, codec: t.rtpmap[pt] ?? STATIC_PT[pt] ?? `PT${pt}` };
  });
}

export function needsTranscode(tracks: ProbeTrack[]): boolean {
  return tracks.some((t) => t.media === 'video' && !WEBRTC_VIDEO_OK.has(t.codec));
}

const STATUS_TEXT: Record<number, string> = {
  401: 'Невірний логін або пароль',
  403: 'Доступ заборонено',
  404: 'Шлях не знайдено на камері (перевірте частину після порту)',
  454: 'Сесію не знайдено',
  461: 'Транспорт не підтримується',
};

export async function probeRtsp(url: string): Promise<ProbeResult> {
  const started = Date.now();
  const deadline = started + TIMEOUT_MS;
  const result = (r: Omit<ProbeResult, 'durationMs' | 'needsTranscode'>): ProbeResult => ({
    ...r,
    needsTranscode: needsTranscode(r.tracks),
    durationMs: Date.now() - started,
  });

  try {
    const t = parseTarget(url);
    let res = await rtspRequest(t, [], deadline);

    if (res.status === 401) {
      if (!t.user) {
        return result({ ok: false, status: 401, tracks: [], error: 'Камера вимагає логін і пароль (додайте user:pass@ в URL)' });
      }
      const auth = buildAuthorization(res.headers.get('www-authenticate') ?? [], t);
      if (!auth) return result({ ok: false, status: 401, tracks: [], error: 'Невідомий спосіб авторизації камери' });
      res = await rtspRequest(t, [`Authorization: ${auth}`], deadline);
    }

    if (res.status !== 200) {
      return result({
        ok: false,
        status: res.status,
        tracks: [],
        error: STATUS_TEXT[res.status] ?? `Камера відповіла RTSP ${res.status}`,
      });
    }
    const tracks = parseSdpTracks(res.body);
    if (!tracks.some((x) => x.media === 'video')) {
      return result({ ok: false, status: 200, tracks, error: 'У потоці немає відео' });
    }
    return result({ ok: true, status: 200, tracks, error: null });
  } catch (err) {
    const msg = err instanceof ProbeError ? err.message : `Помилка: ${(err as Error).message}`;
    return result({ ok: false, status: null, tracks: [], error: msg });
  }
}
