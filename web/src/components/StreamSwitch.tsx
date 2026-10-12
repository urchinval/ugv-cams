import type { StreamKind } from '@ugv/shared';

const LABEL: Record<StreamKind, string> = { sub: 'sub', main: 'main', third: '3rd' };
const TITLE: Record<StreamKind, string> = {
  sub: 'Додатковий потік (легкий, за замовчуванням)',
  main: 'Основний потік (повна якість, більше трафіку)',
  third: 'Третій потік',
};

interface Props {
  available: StreamKind[];
  value: StreamKind;
  onChange: (s: StreamKind) => void;
}

/** Segmented control; hidden entirely when the camera has a single stream. */
export function StreamSwitch({ available, value, onChange }: Props) {
  if (available.length < 2) return null;
  return (
    <div className="stream-switch" role="radiogroup" aria-label="Потік камери">
      {available.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === value}
          className={s === value ? 'is-active' : undefined}
          title={TITLE[s]}
          onClick={() => onChange(s)}
        >
          {LABEL[s]}
        </button>
      ))}
    </div>
  );
}
