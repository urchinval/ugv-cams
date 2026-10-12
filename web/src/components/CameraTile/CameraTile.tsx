import { useEffect, useRef, useState } from 'react';
import { availableStreams, playPath } from '@ugv/shared';
import { useWhepStream } from '../../hooks/useWhepStream.ts';
import { whepUrl } from '../../lib/whep.ts';
import { StatsOverlay } from '../StatsOverlay/StatsOverlay.tsx';
import { StreamSwitch } from '../StreamSwitch/StreamSwitch.tsx';
import { IconCollapse, IconExpand, IconPrimary, IconReload } from '../Icons/Icons.tsx';
import type { CameraTileProps } from './CameraTile.types.ts';

/**
 * One camera. Clean by default: controls appear only on hover / keyboard focus.
 * Always visible: the camera label, plus a status line when there is no picture.
 */
export function CameraTile(p: CameraTileProps) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const { stream, status, stats } = useWhepStream(
    whepUrl(p.webrtcBase, p.camera.id, p.stream, reloadNonce),
    p.debug,
  );
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
      className={['tile', p.maximized && 'is-max', p.editing && 'is-editing']
        .filter(Boolean)
        .join(' ')}
      onDoubleClick={p.editing ? undefined : p.onToggleMax}
    >
      <video
        ref={videoRef}
        className="tile-video"
        autoPlay
        muted
        playsInline
        disablePictureInPicture
      />

      {showStatus && (
        <div className={`tile-status${stream ? ' over-video' : ''}`} role="status">
          {statusText}
        </div>
      )}

      <div className="tile-label">{p.camera.label}</div>

      {p.debug && <StatsOverlay path={playPath(p.camera.id, p.stream)} stats={stats} />}

      <div className="tile-controls" onDoubleClick={(e) => e.stopPropagation()}>
        <StreamSwitch
          available={availableStreams(p.camera)}
          value={p.stream}
          onChange={p.onStreamChange}
        />
        {!p.isPrimary && !p.maximized && (
          <button
            type="button"
            className="icon-btn"
            title="Зробити основною"
            onClick={p.onMakePrimary}
          >
            <IconPrimary />
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          title="Перепідключити"
          onClick={() => setReloadNonce(Date.now())}
        >
          <IconReload />
        </button>
        <button
          type="button"
          className="icon-btn"
          title={p.maximized ? 'Повернути в сітку (Esc)' : 'На весь екран'}
          onClick={p.onToggleMax}
        >
          {p.maximized ? <IconCollapse /> : <IconExpand />}
        </button>
      </div>
    </div>
  );
}
