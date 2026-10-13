import type { Model, RtspTransport, StreamKind } from '@ugv/shared';

export interface ModelEditorProps {
  open: boolean;
  /** null = new model */
  model: Model | null;
  rtspPort: number;
  onClose: () => void;
  onSaved: (m: Model) => void;
  onDeleted: (id: string) => void;
}

/** Form state of one camera: plain strings, validated only on save. */
export interface DraftCamera {
  /** React key; stable while the camera is reordered or its id edited */
  key: string;
  id: string;
  /** id was typed by hand, so it no longer follows the label */
  idTouched: boolean;
  label: string;
  streams: Record<StreamKind, string>;
  transcode: boolean;
  rtspTransport: RtspTransport;
}

export interface Draft {
  name: string;
  cameras: DraftCamera[];
}

/** Validation messages keyed by schema path, e.g. "cameras.0.streams.sub". */
export type FieldErrors = Record<string, string>;

export interface CameraCardProps {
  camera: DraftCamera;
  index: number;
  count: number;
  errors: FieldErrors;
  rtspPort: number;
  onChange: (patch: Partial<DraftCamera>) => void;
  onStreamChange: (kind: StreamKind, value: string) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

export interface StreamFieldProps {
  /** unique per camera + stream, links the label to the input */
  inputId: string;
  kind: StreamKind;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export interface QgcHintProps {
  camera: DraftCamera;
  rtspPort: number;
}
