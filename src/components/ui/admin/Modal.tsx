'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { t } from '@/i18n';

/**
 * Modal (admin) — חלון קופץ בפלטת נייבי-זהב.
 * נסגר ב-Escape ובלחיצה על הרקע. תקין ל-RTL ונגיש (role=dialog, aria-modal).
 * רכיב לקוח (משתמש ב-useEffect למאזין מקלדת ולנעילת גלילה).
 */
type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  variant?: 'admin' | 'public';
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  variant = 'admin',
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
    };
    const dialog = dialogRef.current;
    if (variant === 'public') {
      const bodyWidth = body.getBoundingClientRect().width;
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.width = `${bodyWidth}px`;
      dialog?.showModal();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (variant === 'public') e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (variant === 'public') {
        dialog?.close();
        Object.assign(body.style, previous);
        window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
        previousFocus?.focus({ preventScroll: true });
      }
    };
  }, [open, onClose, variant]);

  if (!open) return null;

  const content = (
    <>
      <div
        className="absolute inset-0 bg-[#1c1512]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl border shadow-2xl shadow-black/40',
          variant === 'public'
            ? 'max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain border-slate-200 bg-white text-slate-900'
            : 'border-[#2f241d] bg-[#241a15] text-[#f3ece0]',
          className,
        )}
      >
        {title ? (
          <div
            className={cn(
              'border-b px-5 py-4',
              variant === 'public'
                ? 'flex items-center justify-between gap-3 border-slate-200'
                : 'border-[#2f241d]',
            )}
          >
            <h2
              id={titleId}
              className={cn(
                'text-lg font-semibold',
                variant === 'admin' && 'text-[#F2D695]',
              )}
            >
              {title}
            </h2>
            {variant === 'public' ? (
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 shrink-0 rounded-lg border border-slate-200 px-3 text-sm"
              >
                {t.common.close}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-[#2f241d] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </>
  );
  if (variant === 'public') {
    return createPortal(
      <dialog
        ref={dialogRef}
        aria-labelledby={title ? titleId : undefined}
        aria-modal="true"
        dir="rtl"
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-transparent p-4 open:flex"
      >
        {content}
      </dialog>,
      document.body,
    );
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      dir="rtl"
    >
      {content}
    </div>
  );
}

export default Modal;
