/**
 * נתוני־על משותפים למדור המשפטי (‎/legal‎).
 * כל התוכן המשפטי מרוכז במודול זה ובקבצים הסמוכים, בהפרדה מרכיבי הקוד.
 *
 * הערה: התוכן במדור זה מוצג לנוחות המשתמשים ואינו מהווה ייעוץ משפטי.
 */

/** תאריך העדכון האחרון של המסמכים המשפטיים בתקן ISO, לשימוש בתגית time. */
export const LEGAL_UPDATED_ISO = '2026-08-19';

/** תווית תאריך העדכון האחרון להצגה למשתמשים. */
export const LEGAL_UPDATED_LABEL = '19 באוגוסט 2026';

/** מבנה פרטי הישות המשפטית שמאחורי השירות. */
export type LegalCompany = {
  /** השם המשפטי של המפעיל. */
  legalName: string;
  /** מספר ח״פ או ע״מ. ריק כאשר אין רישום, ואז השדה אינו מוצג. */
  registrationNumber: string;
  /** כתובת למשלוח דואר. ריקה כאשר אין כתובת פרסום, ואז השדה אינו מוצג. */
  address: string;
  /** דוא״ל ליצירת קשר. */
  contactEmail: string;
  /** טלפון ליצירת קשר. ריק כאשר אין קו פרסום, ואז השדה אינו מוצג. */
  contactPhone: string;
  /** עיר מחוז השיפוט לצורכי סמכות שיפוט. */
  jurisdictionCity: string;
};

/**
 * פרטי הישות המשפטית שמאחורי השירות.
 * השירות מופעל על ידי יחיד, ולכן שדות שאין להם ערך אמיתי נותרים ריקים
 * והעמודים המשפטיים אינם מציגים אותם כלל.
 */
export const LEGAL_COMPANY: LegalCompany = {
  legalName: 'יניב גולטשיאן',
  registrationNumber: '',
  address: '',
  contactEmail: 'yanivgolt@gmail.com',
  contactPhone: '',
  jurisdictionCity: 'תל אביב-יפו',
};

/** מבנה פרטי רכז או רכזת הנגישות ומועד עדכון ההצהרה. */
export type LegalAccessibility = {
  /** שם רכז או רכזת הנגישות. */
  coordinatorName: string;
  /** דוא״ל רכז או רכזת הנגישות, ערוץ הפנייה המרכזי. */
  coordinatorEmail: string;
  /** טלפון רכז או רכזת הנגישות. ריק כאשר אין קו טלפון, ואז השדה אינו מוצג. */
  coordinatorPhone: string;
  /** כתובת למשלוח פניות נגישות. ריקה כאשר אין כתובת, ואז השדה אינו מוצג. */
  coordinatorAddress: string;
  /** תווית מועד עדכון ההצהרה להצגה למשתמשים. */
  statementUpdatedLabel: string;
  /** מועד עדכון ההצהרה בתקן ISO, לשימוש בתגית time. */
  statementUpdatedIso: string;
};

/**
 * פרטי רכז או רכזת הנגישות ומועד עדכון הצהרת הנגישות.
 * ערוץ הפנייה בדוא״ל מספיק לצורך פניות נגישות, ולכן שדות ללא ערך אמיתי
 * נותרים ריקים ואינם מוצגים בהצהרה.
 */
export const LEGAL_ACCESSIBILITY: LegalAccessibility = {
  coordinatorName: 'יניב גולטשיאן',
  coordinatorEmail: 'yanivgolt@gmail.com',
  coordinatorPhone: '',
  coordinatorAddress: '',
  statementUpdatedLabel: '19 באוגוסט 2026',
  statementUpdatedIso: '2026-08-19',
};

/** הערת אי־ייעוץ משפטי המוצגת בראש כל עמוד משפטי. */
export const LEGAL_DISCLAIMER_NOTICE =
  'המידע במדור זה מוצג לנוחות המשתמשים ואינו מהווה ייעוץ משפטי. בכל שאלה או צורך בהתאמה למקרה מסוים מומלץ להיוועץ בעורך או עורכת דין.';
