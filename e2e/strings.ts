/**
 * Hebrew UI strings used by the E2E specs.
 *
 * These are copied verbatim from `src/i18n/he.ts` so the Playwright specs stay
 * decoupled from the app's TS path aliases (`@/…`), which Playwright's esbuild
 * loader does not resolve by default. If a label changes in `he.ts`, update the
 * matching constant here.
 */
export const STRINGS = {
  common: {
    next: 'המשך',
    back: 'חזרה',
  },
  auth: {
    methodPhone: 'טלפון',
    methodEmail: 'אימייל',
    emailLabel: 'כתובת אימייל',
    sendCode: 'שליחת קוד',
  },
  ownerLogin: {
    title: 'כניסת בעלי עסק',
    emailSubmit: 'שליחת קוד',
    clientCta: 'מעבר לכניסת לקוחות',
  },
  booking: {
    steps: {
      services: 'בחירת שירות',
      staff: 'בחירת נותן שירות',
      date: 'בחירת תאריך',
      time: 'בחירת שעה',
      summary: 'סיכום',
      confirm: 'אישור',
    },
    chooseServices: 'אילו שירותים תרצו?',
    chooseStaff: 'עם מי תרצו לקבוע?',
    continueToConfirm: 'המשך לאישור',
    confirmBooking: 'אישור וקביעת התור',
    guestName: 'שם מלא',
    guestEmail: 'כתובת אימייל',
    selectAtLeastOne: 'יש לבחור לפחות שירות אחד',
    successTitle: 'התור נקבע בהצלחה!',
    pendingTitle: 'הבקשה התקבלה וממתינה לאישור',
  },
} as const;
