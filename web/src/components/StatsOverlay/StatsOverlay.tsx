import type { ReactNode } from 'react';
import type { StatsOverlayProps } from './StatsOverlay.types.ts';

/** Above this, artifacts after a loss last visibly long: camera I-frame interval is too big. */
const LONG_GOP_SEC = 3;

const num = (v: number | null, digits = 0) => (v === null ? '–' : v.toFixed(digits));

function Warn({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className={on ? 'is-warn' : undefined}>{children}</span>;
}

/**
 * Debug numbers over a tile (toolbar toggle). Highlighted values point at the usual causes:
 * packet loss -> smearing, freezes -> stalls, long time since I-frame -> slow recovery.
 */
export function StatsOverlay({ path, transport, stats: s }: StatsOverlayProps) {
  const via = transport.toUpperCase();
  if (!s) {
    return (
      <div className="tile-stats" aria-hidden="true">
        {path} · {via} · немає даних
      </div>
    );
  }
  const size = s.width && s.height ? `${s.width}×${s.height}` : '?';
  return (
    <div className="tile-stats" aria-hidden="true">
      <div>
        {path} · {via} · {s.codec ?? '?'} {size}
      </div>
      <div>
        {num(s.fps, 1)} fps · {num(s.kbps)} kb/s
      </div>
      <div>
        <Warn on={(s.lossPct ?? 0) > 0}>втрати {num(s.lossPct, 1)}%</Warn> (всього {s.packetsLost})
        · dropped {s.framesDropped}
      </div>
      <div>
        <Warn on={s.freezes > 0}>
          фризи {s.freezes} / {s.freezeSec.toFixed(1)} с
        </Warn>{' '}
        · <Warn on={s.reconnects > 0}>перепідкл. {s.reconnects}</Warn>
      </div>
      <div>
        jitter {num(s.jitterMs)} мс · буфер {num(s.jitterBufferMs)} мс
      </div>
      <div>
        <Warn on={(s.sinceKeyframeSec ?? 0) > LONG_GOP_SEC}>
          I-кадр {num(s.sinceKeyframeSec, 1)} с тому
        </Warn>{' '}
        · NACK {s.nacks} · PLI {s.plis}
      </div>
    </div>
  );
}
