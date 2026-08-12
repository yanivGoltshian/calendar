import type { ReactNode } from 'react';
import { Mascot, type MascotPose } from './Mascot';

/**
 * עטיפת מצב מרוכזת עם שון — משמשת למסכי טעינה, שגיאה ו"לא נמצא".
 * רכיב תצוגה בלבד (ללא hooks) כדי שיהיה בטוח לייבוא גם משרת וגם מקליינט
 * (למשל error.tsx שחייב להיות 'use client'). תמיד תוספתי, בלי לוגיקה עסקית.
 */
type MascotStateProps = {
  pose?: MascotPose;
  size?: number;
  title: string;
  body?: string;
  alt?: string;
  /** תוכן נוסף מתחת לטקסט (כפתור/קישור). */
  children?: ReactNode;
  className?: string;
};

export function MascotState({
  pose = 'face',
  size = 120,
  title,
  body,
  alt,
  children,
  className,
}: MascotStateProps) {
  return (
    <div
      className={`flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center ${className ?? ''}`}
    >
      <Mascot pose={pose} size={size} alt={alt} className="animate-fade-up opacity-90" />
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      {body ? <p className="max-w-sm text-sm text-slate-500">{body}</p> : null}
      {children}
    </div>
  );
}

export default MascotState;
