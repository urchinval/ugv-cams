import type { Model, StreamKind } from './model.ts';
import type { Layout } from './layout.ts';

/** Contract between server/src/api and web/src/api. */

export interface ModelSummary {
  id: string;
  name: string;
  cameraCount: number;
  updatedAt: string;
}

export interface ActiveResponse {
  model: Model | null;
}

export interface ServerInfo {
  version: string;
  /** Port of MediaMTX WebRTC (WHEP) server; host = the page's own hostname. */
  webrtcPort: number;
  /** Port of MediaMTX RTSP server, for QGC: rtsp://127.0.0.1:<port>/<cam>_<stream> */
  rtspPort: number;
  dataDir: string;
  ffmpegFound: boolean;
}

export interface MtxPathStatus {
  ready: boolean;
  tracks: string[];
  readers: number;
  bytesReceived: number;
}

export interface StatusResponse {
  mediamtx: {
    running: boolean;
    pid: number | null;
    restarts: number;
    lastError: string | null;
  };
  /** keyed by MediaMTX path name (see mtx-paths.ts) */
  paths: Record<string, MtxPathStatus>;
}

export interface ProbeRequest {
  url: string;
}

export interface ProbeTrack {
  media: string; // video | audio | application
  codec: string; // H264, H265, PCMA, ...
}

export interface ProbeResult {
  ok: boolean;
  /** RTSP status code of the final DESCRIBE, if any */
  status: number | null;
  tracks: ProbeTrack[];
  /** true if a video track is H.265 or otherwise not browser-WebRTC friendly */
  needsTranscode: boolean;
  durationMs: number;
  error: string | null;
}

export interface LayoutResponse {
  layout: Layout;
}

export interface ApiError {
  error: string;
  issues?: { path: (string | number)[]; message: string }[];
}

export type { StreamKind };
