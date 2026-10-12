import { ProbeButton } from '../ProbeButton/ProbeButton.tsx';
import { STREAM_PLACEHOLDER, STREAM_TITLE } from './draft.ts';
import type { StreamFieldProps } from './ModelEditor.types.ts';

/** RTSP URL of one stream + "Перевірити" next to it. */
export function StreamField(p: StreamFieldProps) {
  return (
    <div className="field stream-field">
      <label className="field-label" htmlFor={p.inputId}>
        {STREAM_TITLE[p.kind]}
      </label>
      <div className="stream-row">
        <input
          id={p.inputId}
          className={`mono${p.error ? ' has-error' : ''}`}
          value={p.value}
          placeholder={STREAM_PLACEHOLDER[p.kind]}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => p.onChange(e.target.value)}
        />
        <ProbeButton
          url={p.value}
          transcode={p.transcode}
          onEnableTranscode={p.onEnableTranscode}
        />
      </div>
      {p.error && <span className="field-error">{p.error}</span>}
    </div>
  );
}
