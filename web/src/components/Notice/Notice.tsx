import { useLayoutEffect, useRef } from 'react';
import type { NoticeProps } from './Notice.types.ts';

/**
 * Error line for a failed action. A manual popover lives in the top layer, so it shows above
 * an open modal <dialog> (picker / editor) — a plain position:fixed element would sit under it.
 */
export function Notice({ text, onDismiss }: NoticeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.showPopover) return; // old browser: stays a plain fixed element
    el.showPopover();
    return () => {
      if (el.matches(':popover-open')) el.hidePopover();
    };
  }, []);

  return (
    <div ref={ref} popover="manual" className="notice" role="alert" onClick={onDismiss}>
      {text}
    </div>
  );
}
