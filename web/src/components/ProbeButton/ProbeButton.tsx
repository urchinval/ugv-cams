import { useState } from 'react';
import type { ProbeResult } from '@ugv/shared';
import { api } from '../../api/client.ts';
import type { ProbeButtonProps } from './ProbeButton.types.ts';

/** "Перевірити" next to a URL field: RTSP DESCRIBE via the backend, shows codec / error. */
export function ProbeButton({ url, transcode, onEnableTranscode }: ProbeButtonProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [testedUrl, setTestedUrl] = useState('');

  const run = async () => {
    setBusy(true);
    setTestedUrl(url);
    try {
      setResult(await api.probe(url));
    } catch (err) {
      setResult({
        ok: false,
        status: null,
        tracks: [],
        needsTranscode: false,
        durationMs: 0,
        error: (err as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const stale = result && testedUrl !== url;
  const video = result?.tracks.find((t) => t.media === 'video');

  // rendered inside the URL row: button sits next to the input, result wraps onto its own line
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost probe-btn"
        disabled={busy || !url.trim()}
        onClick={run}
      >
        {busy ? 'Перевіряю…' : 'Перевірити'}
      </button>
      {result && !stale && (
        <span
          className={`probe-result ${result.ok ? (result.needsTranscode && !transcode ? 'is-warn' : 'is-ok') : 'is-err'}`}
        >
          {result.ok ? (
            <>
              Відповідає, відео {video?.codec ?? '?'}, {result.durationMs} мс
              {result.needsTranscode &&
                (transcode ? (
                  <>. Транскод увімкнено</>
                ) : (
                  <>
                    . Браузер це не покаже без транскоду.{' '}
                    <button type="button" className="link-btn" onClick={onEnableTranscode}>
                      Увімкнути транскод
                    </button>
                  </>
                ))}
            </>
          ) : (
            result.error
          )}
        </span>
      )}
    </>
  );
}
