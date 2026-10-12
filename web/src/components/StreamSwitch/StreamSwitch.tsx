import type { StreamKind } from '@ugv/shared';
import type { StreamSwitchProps } from './StreamSwitch.types.ts';

const LABEL: Record<StreamKind, string> = { sub: 'sub', main: 'main', third: '3rd' };
const TITLE: Record<StreamKind, string> = {
  sub: 'Додатковий потік (легкий, за замовчуванням)',
  main: 'Основний потік (повна якість, більше трафіку)',
  third: 'Третій потік',
};

/** Segmented control; hidden entirely when the camera has a single stream. */
export function StreamSwitch({ available, value, onChange }: StreamSwitchProps) {
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
