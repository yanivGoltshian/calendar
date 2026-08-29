import type { Metadata } from 'next';
import { LEGAL_COMPANY } from '@/content/legal/meta';
import CopyEmail from './CopyEmail';

export const metadata: Metadata = {
  title: 'עזרה ותמיכה',
};

const FAQ: { q: string; a: string }[] = [
  {
    q: 'איך מוסיפים תור חדש?',
    a: 'בעמוד היומן גררו על טווח השעות הרצוי בעמודת המטפלת, או לחצו על כפתור "תור חדש" בתחתית היומן ומלאו את פרטי הלקוח והשירות.',
  },
  {
    q: 'איך מאשרים תור ממתין?',
    a: 'תורים שנקבעו על ידי לקוחות מופיעים תחת "ממתינים" בעמוד הבית ובמסך ההזמנות. פתחו את הפעמון בסרגל העליון או את מסך ההזמנות כדי לאשר או לדחות.',
  },
  {
    q: 'איך משתפים את עמוד ההזמנות עם לקוחות?',
    a: 'בעמוד הבית מופיעה רצועת השיתוף עם קישור העסק שלכם. העתיקו את הקישור או שתפו אותו בוואטסאפ ישירות מהכפתור.',
  },
  {
    q: 'איך משנים שעות פעילות או מוסיפים אנשי צוות?',
    a: 'פתחו את תפריט "עוד" בסרגל התחתון ובחרו "שעות עבודה" לעדכון ימי וזמני הפעילות, או "צוות" לניהול אנשי הצוות.',
  },
  {
    q: 'איך מסירים את האפליקציה או מתקינים אותה למסך הבית?',
    a: 'בתפריט "עוד" בחרו "התקנת האפליקציה". אם המכשיר לא מציע התקנה אוטומטית, יופיעו הוראות התקנה ידניות לפי סוג המכשיר.',
  },
];

/**
 * עמוד עזרה ותמיכה פנימי (באג 4). מציג תוכן תמיכה בעברית, את כתובת המייל
 * של הצוות כטקסט להעתקה (ללא mailto שחוטף את מערכת ההפעלה), ושאלות נפוצות.
 * אין הפניה חיצונית.
 */
export default function HelpPage() {
  return (
    <main dir="rtl" className="mx-auto w-full max-w-2xl px-4 py-8 text-[var(--ink)]">
      <h1 className="text-2xl font-bold">עזרה ותמיכה</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        כאן תמצאו דרכים לקבל עזרה ותשובות לשאלות הנפוצות ביותר. אנחנו כאן בשבילכם.
      </p>

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--sand)] p-5">
        <h2 className="text-lg font-bold">איך מקבלים עזרה?</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          נתקלתם בבעיה או יש לכם שאלה? כתבו לנו לכתובת הבאה ונחזור אליכם בהקדם.
          העתיקו את הכתובת והדביקו אותה באפליקציית הדוא״ל המועדפת עליכם.
        </p>
        <div className="mt-3">
          <CopyEmail email={LEGAL_COMPANY.contactEmail} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">שאלות נפוצות</h2>
        <div className="mt-3 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="rounded-xl border border-[var(--border)] bg-white p-4"
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
