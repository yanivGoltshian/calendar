import { BRAND } from '@/config/brand';

/**
 * מרשם התבניות של כל ההודעות ללקוח-קצה (מיילים ומסרונים) שהמערכת שולחת.
 *
 * לכל מפתח (key) × ערוץ (channel) מוגדרים: נושא ברירת-מחדל (מייל בלבד), גוף
 * ברירת-מחדל בטקסט רגיל עם מצייני-מיקום בסגנון {{var}}, ורשימת המשתנים המותרים
 * עם תוויות בעברית עבור מסך ההגדרות.
 *
 * חשוב לתאימות-לאחור: מחרוזות ברירת-המחדל כאן זהות מילה-במילה לבנאים הקיימים
 * (build*), כך שכאשר אין דריסת-בעלים ההתנהגות נשארת ללא שינוי. הרינדור בפועל
 * (src/server/messages/render.ts) עובד לפי "fallback-first": בהיעדר דריסה הוא
 * מחזיר את פלט הבנאי הקיים כפי שהוא, ולכן ברירות-המחדל שכאן משמשות בעיקר את מסך
 * ההגדרות (תצוגה, שחזור) ואת בדיקות התאימות.
 */

export type MessageChannel = 'email' | 'sms';

export type MessageKey =
  | 'otp_login'
  | 'booking_confirmation'
  | 'booking_approval'
  | 'reminder'
  | 'waitlist_freed';

/** משתנה מותר בתבנית: השם המילולי ({{name}}) ותווית עברית לתצוגה. */
export interface TemplateVariable {
  /** שם המשתנה כפי שמופיע בין הסוגריים, למשל 'clientName'. */
  name: string;
  /** תווית עברית קצרה למסך ההגדרות. */
  label: string;
}

/** תבנית ברירת-מחדל לערוץ בודד. subject קיים למייל בלבד (undefined ל-SMS). */
export interface ChannelTemplate {
  subject?: string;
  body: string;
}

/** הגדרת הודעה שלמה: תווית, תיאור, משתנים, וברירות-מחדל לכל ערוץ נתמך. */
export interface MessageTemplateDef {
  key: MessageKey;
  /** שם ההודעה בעברית עבור מסך ההגדרות. */
  label: string;
  /** תיאור קצר בעברית (מתי נשלחת ההודעה). */
  description: string;
  variables: TemplateVariable[];
  channels: Partial<Record<MessageChannel, ChannelTemplate>>;
}

// תוויות עברית משותפות למשתנים, לשמירה על עקביות בין ההודעות.
const V = {
  code: { name: 'code', label: 'קוד האימות' },
  brand: { name: 'brand', label: 'שם המותג' },
  clientName: { name: 'clientName', label: 'שם הלקוח' },
  businessName: { name: 'businessName', label: 'שם העסק' },
  services: { name: 'services', label: 'שירות/ים' },
  date: { name: 'date', label: 'תאריך' },
  time: { name: 'time', label: 'שעה' },
  manageUrl: { name: 'manageUrl', label: 'קישור לעמוד/ניהול' },
} as const;

/**
 * מרשם ברירות-המחדל. כל מחרוזת מועתקת מילה-במילה מהבנאי המתאים כדי להבטיח פלט
 * זהה כשאין דריסה. שם המותג משוקף כמשתנה {{brand}}; ברירת-המחדל שלו היא
 * BRAND.name (renderMessage מזין אותו אוטומטית אם לא סופק).
 */
export const MESSAGE_TEMPLATES: Record<MessageKey, MessageTemplateDef> = {
  otp_login: {
    key: 'otp_login',
    label: 'קוד התחברות (OTP)',
    description:
      'קוד אימות חד-פעמי להתחברות. אינו משויך לעסק מסוים, ולכן העריכה נשמרת לשלמות בלבד ואינה משנה את הקוד הנשלח בפועל.',
    variables: [V.code, V.brand],
    channels: {
      email: {
        subject: `{{brand}} · קוד האימות שלך`,
        body: `קוד האימות שלך אל {{brand}} הוא {{code}}. הקוד תקף ל-5 דקות. אם לא ביקשת קוד, אפשר להתעלם מהודעה זו.`,
      },
      sms: {
        body: `{{brand}}: קוד האימות שלך הוא {{code}}`,
      },
    },
  },

  booking_confirmation: {
    key: 'booking_confirmation',
    label: 'אישור הזמנה',
    description: 'נשלחת ללקוח כשהתור נקבע ואושר.',
    variables: [
      V.clientName,
      V.businessName,
      V.services,
      V.date,
      V.time,
      V.manageUrl,
      V.brand,
    ],
    channels: {
      email: {
        subject: `{{brand}} · אישור הזמנה · {{businessName}}`,
        body: [
          `שלום {{clientName}},`,
          ``,
          `התור שלך בעסק {{businessName}} נקבע ואושר.`,
          ``,
          `שירות/ים: {{services}}`,
          `מועד: {{date}} · {{time}}`,
          ``,
          `פרטי העסק: {{manageUrl}}`,
        ].join('\n'),
      },
      sms: {
        body: `{{brand}}: שלום {{clientName}}, התור שלך בעסק {{businessName}} נקבע ואושר. מועד: {{date}} · {{time}}.`,
      },
    },
  },

  booking_approval: {
    key: 'booking_approval',
    label: 'אישור תור (לאחר בקשה)',
    description: 'נשלחת ללקוח כשבקשת התור שלו אושרה על ידי העסק.',
    variables: [
      V.clientName,
      V.businessName,
      V.date,
      V.time,
      V.manageUrl,
      V.brand,
    ],
    channels: {
      email: {
        subject: `{{brand}} · התור שלך אושר · {{businessName}}`,
        body: [
          `שלום {{clientName}},`,
          ``,
          `התור שלך בעסק {{businessName}} אושר.`,
          ``,
          `מועד: {{date}} · {{time}}`,
          ``,
          `פרטי העסק: {{manageUrl}}`,
        ].join('\n'),
      },
      sms: {
        body: `{{brand}}: שלום {{clientName}}, התור שלך בעסק {{businessName}} אושר. מועד: {{date}} · {{time}}.`,
      },
    },
  },

  reminder: {
    key: 'reminder',
    label: 'תזכורת לתור',
    description: 'תזכורת הנשלחת ללקוח לפני מועד התור.',
    variables: [V.businessName, V.date, V.time, V.manageUrl, V.brand],
    channels: {
      email: {
        subject: `תזכורת לתור ב{{businessName}}`,
        body: `שלום, מזכירים לך את התור ב{{businessName}} בתאריך {{date}} בשעה {{time}}. לאישור ההגעה או ביטול: {{manageUrl}}`,
      },
      sms: {
        body: `שלום, מזכירים לך את התור ב{{businessName}} בתאריך {{date}} בשעה {{time}}. לאישור ההגעה או ביטול: {{manageUrl}}`,
      },
    },
  },

  waitlist_freed: {
    key: 'waitlist_freed',
    label: 'התפנה תור (רשימת המתנה)',
    description: 'נשלחת ללקוח ברשימת ההמתנה כשמתפנה מקום מתאים.',
    variables: [V.clientName, V.businessName, V.brand],
    channels: {
      email: {
        subject: `{{brand}} · התפנה תור!`,
        body: `שלום {{clientName}},\nהתפנה מקום מתאים ונשמח לתאם לכם מועד. השיבו למייל זה ליצירת קשר.`,
      },
      sms: {
        body: `{{brand}}: התפנה תור! {{clientName}}, נשמח לתאם לך מועד. השיבו להודעה זו ליצירת קשר.`,
      },
    },
  },
};

/** רשימת כל המפתחות, לפי סדר התצוגה במסך ההגדרות. */
export const MESSAGE_KEYS: MessageKey[] = [
  'booking_confirmation',
  'booking_approval',
  'reminder',
  'waitlist_freed',
  'otp_login',
];

/** האם המחרוזת היא מפתח הודעה מוכר. */
export function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(MESSAGE_TEMPLATES, value);
}

/** האם המחרוזת היא ערוץ מוכר. */
export function isMessageChannel(value: string): value is MessageChannel {
  return value === 'email' || value === 'sms';
}

/** מחזיר את הגדרת ההודעה למפתח נתון. */
export function getTemplateDef(key: MessageKey): MessageTemplateDef {
  return MESSAGE_TEMPLATES[key];
}

/** מחזיר את תבנית ברירת-המחדל לערוץ, או undefined אם הערוץ אינו נתמך למפתח זה. */
export function getChannelDefault(
  key: MessageKey,
  channel: MessageChannel,
): ChannelTemplate | undefined {
  return MESSAGE_TEMPLATES[key]?.channels[channel];
}

/** ברירת-המחדל של שם המותג, לשימוש כערך {{brand}} כשאינו סופק במפורש. */
export const DEFAULT_BRAND = BRAND.name;
