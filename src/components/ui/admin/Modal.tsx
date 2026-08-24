'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

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
};

export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div
        className="absolute inset-0 bg-[#1c1512]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl bg-[#241a15] border border-[#2f241d] ' +
            'shadow-2xl shadow-black/40 text-[#f3ece0]',
          className,
        )}
      >
        {title ? (
          <div className="px-5 py-4 border-b border-[#2f241d]">
            <h2 className="text-lg font-semibold text-[#F2D695]">{title}</h2>
          </div>
        ) : null}
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="px-5 py-4 border-t border-[#2f241d] flex items-center justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Modal;
