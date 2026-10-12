import type { Camera, StreamKind } from '@ugv/shared';

export interface CameraTileProps {
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
