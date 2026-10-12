import type { Model } from '@ugv/shared';

export interface ToolbarProps {
  model: Model | null;
  editing: boolean;
  onPickModel: () => void;
  onToggleEditing: () => void;
  onResetLayout: () => void;
  onFullscreen: () => void;
}
