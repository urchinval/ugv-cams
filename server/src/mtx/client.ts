import type { MtxPathStatus } from '@ugv/shared';

const PATHS_LIST = '/v3/paths/list?itemsPerPage=1000';
const API_TIMEOUT_MS = 1500;

/**
 * Read-only access to the MediaMTX Control API (v3).
 * Parsed defensively: field shapes have shifted between MediaMTX releases.
 */
export async function fetchPathStatuses(apiPort: number): Promise<Record<string, MtxPathStatus>> {
  const res = await fetch(`http://127.0.0.1:${apiPort}${PATHS_LIST}`, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`MediaMTX API HTTP ${res.status}`);
  const body = (await res.json()) as { items?: unknown[] };

  const out: Record<string, MtxPathStatus> = {};
  for (const raw of body.items ?? []) {
    const it = raw as Record<string, unknown>;
    if (typeof it.name !== 'string') continue;
    const tracks = Array.isArray(it.tracks)
      ? it.tracks.map((t) =>
          typeof t === 'string' ? t : String((t as { codec?: unknown })?.codec ?? '?'),
        )
      : [];
    out[it.name] = {
      ready: Boolean(it.ready ?? it.available),
      tracks,
      readers: Array.isArray(it.readers) ? it.readers.length : 0,
      bytesReceived: typeof it.bytesReceived === 'number' ? it.bytesReceived : 0,
    };
  }
  return out;
}
