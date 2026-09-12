import React from 'react';

type SensitiveWatermarkProps = {
  auditId: string;
  className?: string;
};

export function SensitiveWatermark({ auditId, className = '' }: SensitiveWatermarkProps) {
  const safeAuditId = auditId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!safeAuditId) return null;
  const label = `תוכן רגיש · ${safeAuditId}`;

  return (
    <div
      aria-hidden="true"
      data-sensitive-watermark={safeAuditId}
      className={`pointer-events-none fixed inset-0 z-40 overflow-hidden opacity-[0.055] print:opacity-10 ${className}`}
    >
      <div className="absolute inset-[-20%] grid rotate-[-18deg] grid-cols-2 content-around gap-x-16 gap-y-20 text-center text-[11px] font-semibold tracking-[0.16em] text-slate-950 sm:grid-cols-3 sm:gap-x-24 sm:gap-y-28 sm:text-xs dark:text-white">
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} className="whitespace-nowrap">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default SensitiveWatermark;
