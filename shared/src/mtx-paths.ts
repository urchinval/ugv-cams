import type { StreamKind } from './model.ts';

/**
 * MediaMTX path naming — single place both server (yml render) and web (WHEP URLs) use.
 *
 *   <cam>_<stream>       what the browser plays (WebRTC) and QGC can pull (RTSP)
 *   <cam>_<stream>_src   raw camera source, exists only when transcode is on;
 *                        <cam>_<stream> is then the ffmpeg H.264 output
 */
export function playPath(cameraId: string, stream: StreamKind): string {
  return `${cameraId}_${stream}`;
}

export function sourcePath(cameraId: string, stream: StreamKind): string {
  return `${cameraId}_${stream}_src`;
}
