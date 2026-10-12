import type { StreamKind } from '@ugv/shared';

export interface StreamSwitchProps {
  available: StreamKind[];
  value: StreamKind;
  onChange: (s: StreamKind) => void;
}
