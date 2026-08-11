'use client';

/**
 * כפתור שליחה עם אישור. משמש לפעולות בלתי הפיכות (ביטול עסקה) בתוך טופס server-action,
 * בלי להעביר את כל הטופס לרכיב לקוח.
 */
export function ConfirmSubmit({
  children,
  message,
  className,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
