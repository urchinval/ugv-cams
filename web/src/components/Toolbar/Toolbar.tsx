import { IconChevron, IconDebug, IconFullscreen, IconLayout } from '../Icons/Icons.tsx';
import type { ToolbarProps } from './Toolbar.types.ts';

/** Thin strip above the video wall; dimmed until hovered so it does not compete with video. */
export function Toolbar(p: ToolbarProps) {
  return (
    <header className={`toolbar${p.editing ? ' is-editing' : ''}`}>
      <button type="button" className="plate" onClick={p.onPickModel} title="Змінити модель">
        <span className="plate-name">{p.model ? p.model.name : 'Модель не обрано'}</span>
        <IconChevron />
      </button>

      {p.editing && (
        <span className="toolbar-hint">
          Перетягуйте плитки й тягніть за краї, щоб змінити розмір
        </span>
      )}

      <div className="toolbar-actions">
        {p.model && p.editing && (
          <button type="button" className="btn btn-ghost" onClick={p.onResetLayout}>
            Скинути розкладку
          </button>
        )}
        {p.model && (
          <button
            type="button"
            className={`btn ${p.editing ? 'btn-accent' : 'btn-ghost'}`}
            aria-pressed={p.editing}
            onClick={p.onToggleEditing}
          >
            <IconLayout />
            {p.editing ? 'Готово' : 'Розкладка'}
          </button>
        )}
        {p.model && (
          <button
            type="button"
            className={`icon-btn${p.debug ? ' is-active' : ''}`}
            aria-pressed={p.debug}
            title="Діагностика відео: fps, бітрейт, втрати, фризи (для налагодження)"
            onClick={p.onToggleDebug}
          >
            <IconDebug />
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          title="Повноекранний режим браузера (F11)"
          onClick={p.onFullscreen}
        >
          <IconFullscreen />
        </button>
      </div>
    </header>
  );
}
