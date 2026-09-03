import {
  getChannelDefault,
  type MessageChannel,
  type MessageKey,
} from './registry';

/**
 * לוגיקת שמירה טהורה לדריסות תבניות ההודעות. אין כאן גישה ל-DB — רק החלטה,
 * לכל שדה שנשלח מהטופס, האם לשמור דריסה או למחוק אותה (שחזור לברירת-המחדל).
 * מופרד מה-repo כדי שאפשר יהיה לבדוק ביחידה, ומ-parse.ts כדי לא לערבב שכבות.
 */

/** ערך תבנית שהגיע מהטופס, לפני החלטת שמירה. */
export type MessageTemplateInput = {
  key: MessageKey;
  channel: MessageChannel;
  subject: string | null;
  body: string;
};

/** תוצאת ההחלטה: מחיקה (שחזור) או שמירת דריסה עם הערכים המנוקים. */
export type TemplateSaveOp =
  | { action: 'delete' }
  | { action: 'upsert'; subject: string | null; body: string };

/**
 * מחליט מה לעשות עם ערך תבנית שהגיע מהטופס:
 * - גוף ריק ⇐ מחיקה (שחזור לברירת-המחדל; לא שומרים הודעה ריקה).
 * - גוף (ונושא, למייל) זהים לברירת-המחדל ⇐ מחיקה (אין טעם לשמור דריסה זהה).
 * - אחרת ⇐ שמירת דריסה. נושא נשמר למייל בלבד; נושא ריק ⇐ null (נופל חזרה
 *   לנושא ברירת-המחדל בזמן הרינדור).
 */
export function resolveTemplateSave(input: MessageTemplateInput): TemplateSaveOp {
  const def = getChannelDefault(input.key, input.channel);
  const body = input.body.trim();
  const subject = input.subject && input.subject.trim() ? input.subject.trim() : null;

  if (!body) return { action: 'delete' };

  const defBody = def?.body ?? '';
  const defSubject = def?.subject ?? null;
  const bodySame = body === defBody;
  const subjectSame =
    input.channel === 'email' ? (subject ?? defSubject) === defSubject : true;

  if (bodySame && subjectSame) return { action: 'delete' };

  return {
    action: 'upsert',
    subject: input.channel === 'email' ? subject : null,
    body,
  };
}
