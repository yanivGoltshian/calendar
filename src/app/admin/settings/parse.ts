import { z } from 'zod';
import { BusinessType, ReminderChannel } from '@prisma/client';
import {
  normalizePublicPageStyle,
  normalizeLandingContent,
  landingSectionEnabledByDefault,
  TOGGLEABLE_LANDING_SECTIONS,
  MAX_BENEFITS,
  MAX_TESTIMONIALS,
  MAX_GALLERY_IMAGES,
  MAX_FAQ,
  MAX_BEFORE_AFTER,
} from '@/lib/publicPageStyle';
import type { LandingSectionToggles } from '@/lib/publicPageStyle';
import type {
  BusinessProfileInput,
  BookingPolicyInput,
  TransparencyInput,
  CustomTextsInput,
  RemindersInput,
} from '@/server/repos/settings';

/**
 * מנתחי FormData טהורים לסעיפי ההגדרות וההקמה. אין כאן גישה ל-DB או
 * ל-Server Actions, ולכן אפשר לבדוק את מיפוי השדות והוולידציה ביחידה.
 * הן פעולות ההגדרות והן אשף ההקמה משתמשים באותם מנתחים כדי למנוע כפילות.
 */

/** מצב אחיד לכל טופס הגדרות (useActionState). */
export type SaveState = { ok: boolean; error?: string };

/** תוצאת ניתוח: הצלחה עם נתונים או כשל עם קוד שגיאה. */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** קורא ערך טקסט נקי מ-FormData. */
export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

/** מחזיר מחרוזת או null כשריק. */
export function nullableStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v ? v : null;
}

/** תיבת סימון: קיימת ומסומנת ⇐ true. */
export function checkbox(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

const businessTypeValues = Object.values(BusinessType) as string[];
const reminderChannelValues = Object.values(ReminderChannel) as string[];

/**
 * מרכיב את תוכן עמוד הנחיתה משדות הטופס ומעביר לנרמול (סינון ריקים + מגבלות).
 * מחזיר null כשאין תוכן ממשי, כדי לשמור NULL במסד הנתונים.
 */
export function parseLandingContent(fd: FormData) {
  const benefits = [];
  for (let i = 0; i < MAX_BENEFITS; i++) {
    benefits.push({
      title: str(fd, `landingBenefit${i}Title`),
      text: str(fd, `landingBenefit${i}Text`),
    });
  }
  const testimonials = [];
  for (let i = 0; i < MAX_TESTIMONIALS; i++) {
    testimonials.push({
      name: str(fd, `landingTestimonial${i}Name`),
      quote: str(fd, `landingTestimonial${i}Quote`),
    });
  }
  const galleryImageUrls = [];
  for (let i = 0; i < MAX_GALLERY_IMAGES; i++) {
    galleryImageUrls.push(str(fd, `landingGallery${i}`));
  }
  const faq = [];
  for (let i = 0; i < MAX_FAQ; i++) {
    faq.push({
      question: str(fd, `landingFaq${i}Question`),
      answer: str(fd, `landingFaq${i}Answer`),
    });
  }
  const beforeAfter = [];
  for (let i = 0; i < MAX_BEFORE_AFTER; i++) {
    beforeAfter.push({
      beforeUrl: str(fd, `landingBefore${i}Url`),
      afterUrl: str(fd, `landingAfter${i}Url`),
      label: str(fd, `landingBeforeAfter${i}Label`),
    });
  }

  // מתגי המקטעים: שומרים רק בחירות שסוטות מברירת המחדל לפי סוג העסק,
  // כדי שעסק שלא נגע בעמוד הנחיתה יישאר עם landingContent ריק (NULL).
  const type = str(fd, 'type') || null;
  const sections: LandingSectionToggles = {};
  for (const key of TOGGLEABLE_LANDING_SECTIONS) {
    const checked = checkbox(fd, `landingSection_${key}`);
    if (checked !== landingSectionEnabledByDefault(key, type)) sections[key] = checked;
  }

  return normalizeLandingContent({
    heroEyebrow: str(fd, 'landingHeroEyebrow'),
    heroHeadline: str(fd, 'landingHeroHeadline'),
    heroSubtext: str(fd, 'landingHeroSubtext'),
    benefits,
    galleryImageUrls,
    beforeAfter,
    testimonials,
    faq,
    about: str(fd, 'landingAbout'),
    announcement: str(fd, 'landingAnnouncement'),
    googleReviewsUrl: str(fd, 'landingGoogleReviewsUrl'),
    socialLinks: {
      whatsapp: str(fd, 'landingSocialWhatsapp'),
      instagram: str(fd, 'landingSocialInstagram'),
      facebook: str(fd, 'landingSocialFacebook'),
      tiktok: str(fd, 'landingSocialTiktok'),
    },
    ctaLabel: str(fd, 'landingCtaLabel'),
    sections,
  });
}

/** ניתוח פרופיל העסק. שם חובה; סוג לא חוקי ⇐ שגיאה. */
export function parseProfile(fd: FormData): ParseResult<BusinessProfileInput> {
  const name = str(fd, 'name');
  if (!name) return { ok: false, error: 'name' };

  const rawType = str(fd, 'type');
  let type: BusinessType | null = null;
  if (rawType) {
    if (!businessTypeValues.includes(rawType)) return { ok: false, error: 'bad_request' };
    type = rawType as BusinessType;
  }

  return {
    ok: true,
    data: {
      name,
      type,
      phone: nullableStr(fd, 'phone'),
      address: nullableStr(fd, 'address'),
      description: nullableStr(fd, 'description'),
      instagramUrl: nullableStr(fd, 'instagramUrl'),
      logoUrl: nullableStr(fd, 'logoUrl'),
      coverImageUrl: nullableStr(fd, 'coverImageUrl'),
      brandColor: nullableStr(fd, 'brandColor'),
      timezone: str(fd, 'timezone') || 'Asia/Jerusalem',
      publicPageStyle: normalizePublicPageStyle(str(fd, 'publicPageStyle')),
      landingContent: parseLandingContent(fd),
    },
  };
}

export const policySchema = z.object({
  minLeadTimeMinutes: z.coerce.number().int().min(0),
  cancellationWindowHours: z.coerce.number().int().min(0),
  slotGranularityMinutes: z.coerce.number().int().min(1),
  maxAdvanceBookingDays: z.coerce.number().int().min(1),
});

/** ניתוח מדיניות ההזמנה. מספרים לא חוקיים ⇐ שגיאה. */
export function parsePolicy(fd: FormData): ParseResult<BookingPolicyInput> {
  const parsed = policySchema.safeParse({
    minLeadTimeMinutes: fd.get('minLeadTimeMinutes'),
    cancellationWindowHours: fd.get('cancellationWindowHours'),
    slotGranularityMinutes: fd.get('slotGranularityMinutes'),
    maxAdvanceBookingDays: fd.get('maxAdvanceBookingDays'),
  });
  if (!parsed.success) return { ok: false, error: 'number' };

  return {
    ok: true,
    data: {
      ...parsed.data,
      bookingRequiresApproval: checkbox(fd, 'bookingRequiresApproval'),
      requirePhoneVerification: checkbox(fd, 'requirePhoneVerification'),
      allowBookingWithoutPhone: checkbox(fd, 'allowBookingWithoutPhone'),
      requireEmail: checkbox(fd, 'requireEmail'),
    },
  };
}

/** ניתוח מתגי השקיפות בעמוד הציבורי. תמיד תקין. */
export function parseTransparency(fd: FormData): TransparencyInput {
  return {
    showPricesPublic: checkbox(fd, 'showPricesPublic'),
    showDurationPublic: checkbox(fd, 'showDurationPublic'),
    showStaffPublic: checkbox(fd, 'showStaffPublic'),
  };
}

/** ניתוח הטקסטים המותאמים ללקוח. תמיד תקין. */
export function parseTexts(fd: FormData): CustomTextsInput {
  return {
    welcomeMessage: nullableStr(fd, 'welcomeMessage'),
    confirmationMessage: nullableStr(fd, 'confirmationMessage'),
    policyText: nullableStr(fd, 'policyText'),
  };
}

/** ניתוח תצורת התזכורות. שעות התראה לא חוקיות ⇐ שגיאה; ערוץ לא חוקי ⇐ AUTO. */
export function parseReminders(fd: FormData): ParseResult<RemindersInput> {
  const leadParsed = z.coerce.number().int().min(0).safeParse(fd.get('reminderLeadHours'));
  if (!leadParsed.success) return { ok: false, error: 'number' };

  const rawChannel = str(fd, 'reminderChannel');
  const channel: ReminderChannel = reminderChannelValues.includes(rawChannel)
    ? (rawChannel as ReminderChannel)
    : ReminderChannel.AUTO;

  return {
    ok: true,
    data: {
      remindersEnabled: checkbox(fd, 'remindersEnabled'),
      reminderChannel: channel,
      reminderLeadHours: leadParsed.data,
      confirmationRequired: checkbox(fd, 'confirmationRequired'),
    },
  };
}
