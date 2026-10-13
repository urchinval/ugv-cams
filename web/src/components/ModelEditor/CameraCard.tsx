import { STREAM_KINDS } from '@ugv/shared';
import { IconDown, IconTrash, IconUp } from '../Icons/Icons.tsx';
import { QgcHint } from './QgcHint.tsx';
import { StreamField } from './StreamField.tsx';
import type { CameraCardProps } from './ModelEditor.types.ts';

/** One camera in the editor: name, id, order, stream URLs, transcode, QGC hint. */
export function CameraCard(p: CameraCardProps) {
  const c = p.camera;
  const err = (field: string) => p.errors[`cameras.${p.index}.${field}`];

  return (
    <li className="cam-card">
      <div className="cam-head">
        <span className="cam-index" aria-hidden="true">
          {p.index + 1}
        </span>
        <label className="field cam-label">
          <span className="field-label">Назва камери</span>
          <input
            className={err('label') ? 'has-error' : undefined}
            value={c.label}
            placeholder="Камера"
            onChange={(e) => p.onChange({ label: e.target.value })}
          />
          {err('label') && <span className="field-error">{err('label')}</span>}
        </label>
        <label className="field cam-id">
          <span className="field-label">ID</span>
          <input
            className={err('id') ? 'has-error' : undefined}
            value={c.id}
            spellCheck={false}
            onChange={(e) => p.onChange({ id: e.target.value.toLowerCase(), idTouched: true })}
          />
          {err('id') && <span className="field-error">{err('id')}</span>}
        </label>
        <div className="cam-order">
          <button
            type="button"
            className="icon-btn"
            title="Вище"
            disabled={p.index === 0}
            onClick={() => p.onMove(-1)}
          >
            <IconUp />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Нижче"
            disabled={p.index === p.count - 1}
            onClick={() => p.onMove(1)}
          >
            <IconDown />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Видалити камеру"
            disabled={p.count === 1}
            onClick={p.onRemove}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {STREAM_KINDS.map((kind) => (
        <StreamField
          key={kind}
          inputId={`${c.key}-${kind}`}
          kind={kind}
          value={c.streams[kind]}
          error={err(`streams.${kind}`)}
          onChange={(v) => p.onStreamChange(kind, v)}
        />
      ))}

      <label className="check">
        <input
          type="checkbox"
          checked={c.transcode}
          onChange={(e) => p.onChange({ transcode: e.target.checked })}
        />
        <span>
          Транскодувати в H.264 на ноуті (для камер з H.265). Потрібен ffmpeg і додає 100–200 мс
          затримки.
        </span>
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={c.rtspTransport === 'udp'}
          onChange={(e) => p.onChange({ rtspTransport: e.target.checked ? 'udp' : 'tcp' })}
        />
        <span>
          Тягнути камеру по UDP: менше фризів на Starlink, але втрачений пакет дає артефакти до
          наступного I-кадру. Потрібен вхідний UDP через тунель і Windows Firewall; якщо картинки
          немає, поверніть TCP.
        </span>
      </label>

      <QgcHint camera={c} rtspPort={p.rtspPort} />
    </li>
  );
}
