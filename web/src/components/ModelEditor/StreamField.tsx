import { STREAM_PLACEHOLDER, STREAM_TITLE } from './draft.ts';
import type { StreamFieldProps } from './ModelEditor.types.ts';

/** RTSP URL of one stream. */
export function StreamField(p: StreamFieldProps) {
  return (
    <div className="field stream-field">
      <label className="field-label" htmlFor={p.inputId}>
        {STREAM_TITLE[p.kind]}
      </label>
      <input
        id={p.inputId}
        className={`mono${p.error ? ' has-error' : ''}`}
        value={p.value}
        placeholder={STREAM_PLACEHOLDER[p.kind]}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => p.onChange(e.target.value)}
      />
      {p.error && <span className="field-error">{p.error}</span>}
    </div>
  );
}
