import type { ModelSummary } from '@ugv/shared';

export interface ModelPickerProps {
  open: boolean;
  models: ModelSummary[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onCreate: () => void;
  onImported: (id: string) => void;
}
