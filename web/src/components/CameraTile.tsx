import { useEffect, useRef, useState } from 'react';
import { availableStreams, playPath, type Camera, type StreamKind } from '@ugv/shared';
import { useWhepStream } from '../hooks/useWhepStream.ts';
import { StreamSwitch } from './StreamSwitch.tsx';
import { IconCollapse, IconExpand, IconPrimary, IconReload } from './icons.tsx';

interface Props {
  camera: Camera;
  stream: StreamKind;
  webrtcBase: string;
  isPrimary: boolean;
  maximized: boolean;
  editing: boolean;
  onStreamChange: (s: StreamKind) => void;
  onMakePrimary: () => void;
  onToggleMax: () => void;
}

/**
 * One camera. Clean by default: controls appear only on hover / keyboard focus.
 * Always visible: the camera label, plus a status line when there is no picture.
 */
export function CameraTile(p: Props) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const url = `${p.webrtcBase}/${playPath(p.camera.id, p.stream)}/whep${reloadNonce ? `?r=${reloadNonce}` : ''}`;
  const { stream, status } = useWhepStream(url);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (v && v.srcObject !== stream) v.srcObject = stream;
  }, [stream]);

  const showStatus = !stream || status.state === 'retrying';
  const statusText =
    status.state === 'retrying'
      ? `Перепідключення${status.detail ? `: ${status.detail}` : ''}`
      : 'Підключення…';

  return (
    <div
      className={['tile', p.maximized && 'is-max', p.editing && 'is-editing'].filter(Boolean).join(' ')}
      onDoubleClick={p.editing ? undefined : p.onToggleMax}
    >
      <video ref={videoRef} className="tile-video" autoPlay muted playsInline disablePictureInPicture />

      {showStatus && (
        <div className={`tile-status${stream ? ' over-video' : ''}`} role="status">
          {statusText}
        </div>
      )}

      <div className="tile-label">{p.camera.label}</div>

      <div className="tile-controls" onDoubleClick={(e) => e.stopPropagation()}>
        <StreamSwitch available={availableStreams(p.camera)} value={p.stream} onChange={p.onStreamChange} />
        {!p.isPrimary && !p.maximized && (
          <button type="button" className="icon-btn" title="Зробити основною" onClick={p.onMakePrimary}>
            <IconPrimary />
          </button>
        )}
        <button type="button" className="icon-btn" title="Перепідключити" onClick={() => setReloadNonce(Date.now())}>
          <IconReload />
        </button>
        <button
          type="button"
          className="icon-btn"
          title={p.maximized ? 'Повернути в сітку (Esc)' : 'На весь екран (подвійний клік)'}
          onClick={p.onToggleMax}
        >
          {p.maximized ? <IconCollapse /> : <IconExpand />}
        </button>
      </div>
    </div>
  );
}
