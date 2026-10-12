import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './icons.tsx';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Native <dialog>: focus trap, Esc and backdrop for free. */
export function Dialog({ open, title, onClose, children, footer, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' is-wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose(); // click on backdrop
      }}
    >
      {open && (
        <div className="dialog-panel">
          <header className="dialog-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
              <IconClose />
            </button>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
