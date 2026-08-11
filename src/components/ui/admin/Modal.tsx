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
        className="absolute inset-0 bg-[#08101C]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl bg-[#0B1526] border border-[#16233A] ' +
            'shadow-2xl shadow-black/40 text-[#E8ECF3]',
          className,
        )}
      >
        {title ? (
          <div className="px-5 py-4 border-b border-[#16233A]">
            <h2 className="text-lg font-semibold text-[#F2D695]">{title}</h2>
          </div>
        ) : null}
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="px-5 py-4 border-t border-[#16233A] flex items-center justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Modal;
