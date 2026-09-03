import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWaitlistNotifyChannel,
  buildWaitlistNotifyEmail,
} from './waitlistNotify';

/**
 * מבחני יחידה ללוגיקת יידוע רשימת ההמתנה — הפונקציות הטהורות ב-`waitlistNotify.ts`.
 *
 * המודול נבנה בנפרד מ-`waitlist.ts` בדיוק כדי שניתן יהיה לבדוק את בורר הערוץ ואת בניית
 * מייל "התפנה תור!" בלי לייבא את Prisma (`@/lib/db`) או את שער ה-SMS. כך הבדיקה רצה
 * בסביבה ללא מסד וללא SMTP.
 */

// --- בורר הערוץ: אקסקלוסיב→sms, לא-אקסקלוסיב+מייל→email, אחרת→none ---

test('בורר ערוץ: אקסקלוסיב תמיד שולח SMS, גם כשקיים מייל', () => {
  assert.equal(resolveWaitlistNotifyChannel({ isExclusive: true, email: null }), 'sms');
  assert.equal(
    resolveWaitlistNotifyChannel({ isExclusive: true, email: 'dana@example.com' }),
    'sms',
  );
});

test('בורר ערוץ: לא-אקסקלוסיב עם מייל תקין → email', () => {
  assert.equal(
    resolveWaitlistNotifyChannel({ isExclusive: false, email: 'dana@example.com' }),
    'email',
  );
  // ברירת המחדל (isExclusive לא מוגדר) נחשבת לא-אקסקלוסיב.
  assert.equal(resolveWaitlistNotifyChannel({ email: 'dana@example.com' }), 'email');
});

test('בורר ערוץ: לא-אקסקלוסיב ללא מייל (או מייל ריק) → none', () => {
  assert.equal(resolveWaitlistNotifyChannel({ isExclusive: false, email: null }), 'none');
  assert.equal(resolveWaitlistNotifyChannel({ isExclusive: false }), 'none');
  assert.equal(resolveWaitlistNotifyChannel({ isExclusive: false, email: '' }), 'none');
  assert.equal(resolveWaitlistNotifyChannel({ isExclusive: false, email: '   ' }), 'none');
});

// --- בניית מייל היידוע "התפנה תור!" ---

test('בניית מייל: הנושא כולל את שם המותג ואת כותרת "התפנה תור!"', () => {
  const { subject } = buildWaitlistNotifyEmail('דנה');
  assert.match(subject, /התפנה תור!/);
  assert.match(subject, /תור צ/); // שם המותג (תור צ׳יק)
});

test('בניית מייל: גוף הטקסט כולל את שם הלקוח', () => {
  const { text } = buildWaitlistNotifyEmail('דנה כהן');
  assert.match(text, /דנה כהן/);
});

test('בניית מייל: גוף ה-HTML בכיווניות עברית (dir="rtl")', () => {
  const { html } = buildWaitlistNotifyEmail('דנה');
  assert.match(html, /dir="rtl"/);
  assert.match(html, /התפנה תור!/);
});

test('בניית מייל: שם הלקוח עובר escape כדי למנוע הזרקת HTML', () => {
  const { html } = buildWaitlistNotifyEmail('<script>alert(1)</script>');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
