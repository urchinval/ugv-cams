import { CameraIdSchema, playPath, STREAM_KINDS } from '@ugv/shared';
import type { QgcHintProps } from './ModelEditor.types.ts';

/**
 * Where QGC finds this camera: MediaMTX re-streams every configured stream locally.
 * Built from the draft, so it follows the id and URL fields while typing.
 */
export function QgcHint({ camera, rtspPort }: QgcHintProps) {
  if (!CameraIdSchema.safeParse(camera.id).success) return null;
  const kinds = STREAM_KINDS.filter((k) => camera.streams[k].trim());
  if (!kinds.length) return null;
  return (
    <div className="qgc-hint">
      <span className="qgc-hint-label">У QGC:</span>
      {kinds.map((k) => (
        <code key={k}>{`rtsp://127.0.0.1:${rtspPort}/${playPath(camera.id.trim(), k)}`}</code>
      ))}
    </div>
  );
}
