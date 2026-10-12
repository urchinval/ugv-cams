import type { Layout, Model, StreamKind } from '@ugv/shared';

export interface CameraGridProps {
  model: Model;
  layout: Layout;
  streams: Record<string, StreamKind>;
  webrtcBase: string;
  editing: boolean;
  debug: boolean;
  maximized: string | null;
  onLayoutChange: (l: Layout) => void;
  onLayoutCommit: (l: Layout) => void;
  onStreamChange: (cameraId: string, s: StreamKind) => void;
  onMakePrimary: (cameraId: string) => void;
  onToggleMax: (cameraId: string) => void;
}
