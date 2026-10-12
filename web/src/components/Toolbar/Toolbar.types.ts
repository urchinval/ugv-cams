import type { Model } from '@ugv/shared';

export interface ToolbarProps {
  model: Model | null;
  editing: boolean;
  debug: boolean;
  onPickModel: () => void;
  onToggleEditing: () => void;
  onToggleDebug: () => void;
  onResetLayout: () => void;
  onFullscreen: () => void;
}
