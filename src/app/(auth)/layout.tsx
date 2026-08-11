import type { ReactNode } from 'react';

/** מעטפת מסכי אימות: רקע נייבי מלא עם מרכוז התוכן. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#0B1526] px-4 py-10"
    >
      {children}
    </main>
  );
}
