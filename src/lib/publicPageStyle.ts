/**
 * לוגיקה טהורה (ללא JSX) לעמוד העסק הציבורי:
 *  - מיפוי סוג העסק לאייקון הכותרת של אזור השירותים (באג 1).
 *  - ברירות מחדל תלויות-סוג לעמוד הנחיתה (כותרת ראשית, תת-כותרת ויתרונות).
 *  - נרמול תוכן עמוד הנחיתה שמגיע מטופס הניהול או ממסד הנתונים.
 *
 * המודול נטול תלות בקליינט של Prisma או ב-React כדי שיהיה קל לבדיקה תחת node --test.
 */

/** מפתחות סוגי העסק (תואמים ל-enum BusinessType בסכימה). */
export type BusinessTypeKey =
  | 'BARBERSHOP'
  | 'HAIR_SALON'
  | 'NAILS'
  | 'BEAUTY_COSMETICS'
  | 'SPA_MASSAGE'
  | 'BROWS_LASHES'
  | 'TATTOO_PIERCING'
  | 'CLINIC'
  | 'FITNESS'
  | 'OTHER';

/** מפתחות האייקונים שאזור השירותים יכול להציג. */
export type SectionIconKey =
  | 'scissors'
  | 'dumbbell'
  | 'stethoscope'
  | 'leaf'
  | 'sparkle'
  | 'eye'
  | 'needle'
  | 'sparkles'
  | 'calendar';

const SECTION_ICON_BY_TYPE: Record<BusinessTypeKey, SectionIconKey> = {
  BARBERSHOP: 'scissors',
  HAIR_SALON: 'scissors',
  NAILS: 'sparkle',
  BEAUTY_COSMETICS: 'sparkles',
  SPA_MASSAGE: 'leaf',
  BROWS_LASHES: 'eye',
  TATTOO_PIERCING: 'needle',
  CLINIC: 'stethoscope',
  FITNESS: 'dumbbell',
  OTHER: 'calendar',
};

/**
 * מחזיר את מפתח האייקון המתאים לכותרת "השירותים שלנו" לפי סוג העסק.
 * סוג לא ידוע או חסר נופל לאייקון לוח השנה (calendar) — ניטרלי ומתאים להזמנות.
 */
export function sectionIconKey(type?: string | null): SectionIconKey {
  if (!type) return 'calendar';
  const key = type as BusinessTypeKey;
  return SECTION_ICON_BY_TYPE[key] ?? 'calendar';
}

/** מפתחות מקטעי עמוד הנחיתה העשיר — כל מקטע ניתן להצגה/הסתרה מהניהול. */
export type LandingSectionKey =
  | 'hero'
  | 'highlights'
  | 'services'
  | 'gallery'
  | 'beforeAfter'
  | 'testimonials'
  | 'faq'
  | 'about'
  | 'location'
  | 'socialCta';

/** הסדר הקבוע שבו המקטעים מופיעים בעמוד הנחיתה. */
export const LANDING_SECTION_ORDER: LandingSectionKey[] = [
  'hero',
  'highlights',
  'services',
  'gallery',
  'beforeAfter',
  'testimonials',
  'faq',
  'about',
  'location',
  'socialCta',
];

/** המקטעים שהבעלים יכול לכבות/להדליק (hero תמיד מוצג — הוא כותרת העמוד). */
export const TOGGLEABLE_LANDING_SECTIONS: LandingSectionKey[] = LANDING_SECTION_ORDER.filter(
  (key) => key !== 'hero',
);

/** יתרון בודד בעמוד הנחיתה. */
export interface LandingBenefit {
  title: string;
  text: string;
}

/** המלצת לקוח בודדת בעמוד הנחיתה. */
export interface LandingTestimonial {
  name: string;
  quote: string;
}

/** שאלה ותשובה בודדת במקטע השאלות הנפוצות. */
export interface LandingFaqItem {
  question: string;
  answer: string;
}

/** זוג תמונות "לפני / אחרי" בודד. */
export interface LandingBeforeAfter {
  beforeUrl: string;
  afterUrl: string;
  label: string;
}

/** קישורי רשתות חברתיות למקטע ה-CTA הסוגר. */
export interface LandingSocialLinks {
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

/** מפת הצגה/הסתרה של מקטעי עמוד הנחיתה (true = מוצג). */
export type LandingSectionToggles = Partial<Record<LandingSectionKey, boolean>>;

/** תוכן עמוד הנחיתה הנשמר בשדה Business.landingContent (Json). כל השדות אופציונליים. */
export interface LandingContent {
  heroEyebrow?: string;
  heroHeadline?: string;
  heroSubtext?: string;
  benefits?: LandingBenefit[];
  galleryImageUrls?: string[];
  beforeAfter?: LandingBeforeAfter[];
  testimonials?: LandingTestimonial[];
  faq?: LandingFaqItem[];
  about?: string;
  socialLinks?: LandingSocialLinks;
  ctaLabel?: string;
  sections?: LandingSectionToggles;
}

/** ברירות מחדל תלויות-סוג שמוצגות בעמוד הנחיתה כשאין תוכן מותאם. */
export interface LandingDefaults {
  heroHeadline: string;
  heroSubtext: string;
  benefits: LandingBenefit[];
}

/** מגבלות כמות — נאכפות גם בנרמול וגם בטופס הניהול. */
export const MAX_BENEFITS = 3;
export const MAX_TESTIMONIALS = 3;
export const MAX_GALLERY_IMAGES = 4;
export const MAX_FAQ = 5;
export const MAX_BEFORE_AFTER = 3;

/** מגבלות אורך טקסט (קיטום עדין כדי לשמור על עיצוב נקי). */
const LIMITS = {
  heroEyebrow: 60,
  heroHeadline: 140,
  heroSubtext: 400,
  benefitTitle: 60,
  benefitText: 220,
  testimonialName: 60,
  testimonialQuote: 400,
  galleryUrl: 2048,
  faqQuestion: 160,
  faqAnswer: 500,
  beforeAfterLabel: 80,
  about: 900,
  ctaLabel: 40,
  socialUrl: 2048,
} as const;

const DEFAULTS_BY_TYPE: Record<BusinessTypeKey, LandingDefaults> = {
  FITNESS: {
    heroHeadline: 'כושר שמביא תוצאות',
    heroSubtext: 'אימונים אישיים וקבוצתיים בהתאמה אליכם. קבעו אימון ראשון והתחילו לזוז.',
    benefits: [
      { title: 'מאמנים מוסמכים', text: 'צוות מקצועי שמלווה אתכם לכל אורך הדרך.' },
      { title: 'תוכנית אישית', text: 'תוכנית אימונים שנבנית סביב היעדים והקצב שלכם.' },
      { title: 'קביעת אימון בקליק', text: 'בוחרים זמן שנוח לכם ומגיעים מוכנים לאימון.' },
    ],
  },
  CLINIC: {
    heroHeadline: 'טיפול מקצועי, יחס אישי',
    heroSubtext: 'צוות מנוסה שמקשיב לכם ודואג לבריאות שלכם. קבעו תור בקלות.',
    benefits: [
      { title: 'צוות מנוסה', text: 'אנשי מקצוע מוסמכים עם ניסיון רב.' },
      { title: 'יחס אישי', text: 'מקשיבים לכם ומתאימים את הטיפול לצרכים שלכם.' },
      { title: 'זימון תורים נוח', text: 'קובעים תור אונליין בלי המתנה בטלפון.' },
    ],
  },
  SPA_MASSAGE: {
    heroHeadline: 'רגע של שקט בשבילכם',
    heroSubtext: 'עיסויים וטיפולי גוף מפנקים באווירה רגועה. הזמינו זמן לעצמכם.',
    benefits: [
      { title: 'אווירה רוגעת', text: 'חלל נעים ושקט שמזמין הרפיה מלאה.' },
      { title: 'מטפלים מיומנים', text: 'ידיים מקצועיות שיודעות מה הגוף צריך.' },
      { title: 'טיפולים בהתאמה', text: 'בוחרים את הטיפול שהכי מתאים לכם.' },
    ],
  },
  NAILS: {
    heroHeadline: 'ציפורניים מושלמות בכל פעם',
    heroSubtext: 'מניקור, פדיקור ועיצוב ציפורניים בגימור מוקפד. קבעו תור.',
    benefits: [
      { title: 'עיצוב מוקפד', text: 'תשומת לב לכל פרט, בכל לק ובכל צורה.' },
      { title: 'חומרים איכותיים', text: 'מוצרים מקצועיים לגימור עמיד ויפה.' },
      { title: 'חוויה מפנקת', text: 'פינוק קטן שמשאיר אתכם עם חיוך.' },
    ],
  },
  BROWS_LASHES: {
    heroHeadline: 'מבט שמדבר בעד עצמו',
    heroSubtext: 'עיצוב גבות והארכת ריסים בהתאמה מדויקת לפנים שלכם. קבעו תור.',
    benefits: [
      { title: 'התאמה אישית', text: 'עיצוב שמדגיש את הקווים הטבעיים שלכם.' },
      { title: 'דיוק מקצועי', text: 'ידיים בטוחות ותוצאה נקייה ומדויקת.' },
      { title: 'תוצאה שנשארת', text: 'מראה מטופח לאורך זמן.' },
    ],
  },
  TATTOO_PIERCING: {
    heroHeadline: 'אמנות על העור שלכם',
    heroSubtext: 'קעקועים ופירסינג בסטנדרט היגייני גבוה ובעיצוב אישי. קבעו ייעוץ.',
    benefits: [
      { title: 'עיצוב אישי', text: 'מלווים אתכם מהרעיון ועד לתוצאה הסופית.' },
      { title: 'היגיינה קפדנית', text: 'סטנדרט ניקיון ובטיחות ללא פשרות.' },
      { title: 'אמנים מנוסים', text: 'יד יציבה וניסיון שנראה בתוצאה.' },
    ],
  },
  BEAUTY_COSMETICS: {
    heroHeadline: 'הזוהר הטבעי שלכם',
    heroSubtext: 'טיפולי פנים וקוסמטיקה מתקדמים לעור בריא וזוהר. קבעו תור.',
    benefits: [
      { title: 'טיפולים מתקדמים', text: 'שיטות וטכנולוגיות עדכניות לתוצאות נראות.' },
      { title: 'התאמה לעור שלכם', text: 'אבחון אישי ובחירת הטיפול הנכון.' },
      { title: 'יחס חם', text: 'חוויה מפנקת מהרגע שנכנסתם.' },
    ],
  },
  BARBERSHOP: {
    heroHeadline: 'תספורת שמרגישים בה בבית',
    heroSubtext: 'תספורות, זקן וטיפוח לגבר בסטייל. קבעו תור בקליק.',
    benefits: [
      { title: 'ספרים מנוסים', text: 'ידיים מקצועיות וסטייל מדויק.' },
      { title: 'אווירה נעימה', text: 'מקום שכיף לשבת בו, לא רק להסתפר.' },
      { title: 'קביעת תור מהירה', text: 'בוחרים זמן ומגיעים בלי להמתין.' },
    ],
  },
  HAIR_SALON: {
    heroHeadline: 'השיער שלכם, במיטבו',
    heroSubtext: 'תספורות, צבע וטיפולי שיער בהתאמה אישית. קבעו תור.',
    benefits: [
      { title: 'מעצבי שיער מנוסים', text: 'מקצוענים שמבינים מה מתאים לכם.' },
      { title: 'מוצרים איכותיים', text: 'חומרים מקצועיים לשיער בריא ומטופח.' },
      { title: 'התאמה אישית', text: 'מקשיבים לכם ומעצבים לפי הרצון.' },
    ],
  },
  OTHER: {
    heroHeadline: 'הזמינו תור בקלות',
    heroSubtext: 'שירות מקצועי ויחס אישי. בחרו זמן שנוח לכם וקבעו תור בכמה קליקים.',
    benefits: [
      { title: 'שירות מקצועי', text: 'צוות מנוסה שנותן שירות ברמה גבוהה.' },
      { title: 'יחס אישי', text: 'מתאימים את השירות בדיוק לצרכים שלכם.' },
      { title: 'זימון אונליין', text: 'קובעים תור בקליק, מתי שנוח לכם.' },
    ],
  },
};

/**
 * מחזיר ברירות מחדל תלויות-סוג לעמוד הנחיתה (כותרת, תת-כותרת ושלושה יתרונות).
 * סוג לא ידוע או חסר נופל לעותק גנרי (OTHER).
 */
export function landingDefaults(type?: string | null): LandingDefaults {
  const key = (type ?? 'OTHER') as BusinessTypeKey;
  return DEFAULTS_BY_TYPE[key] ?? DEFAULTS_BY_TYPE.OTHER;
}

/** מנרמל את שם סגנון העמוד — כל קלט לא צפוי נופל ל-BOOKING. */
export function normalizePublicPageStyle(input?: string | null): 'BOOKING' | 'LANDING' {
  return input === 'LANDING' ? 'LANDING' : 'BOOKING';
}

function cleanString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> =>
    typeof item === 'object' && item !== null,
  );
}

/**
 * מנרמל תוכן עמוד נחיתה מקלט חופשי (JSON ממסד הנתונים או אובייקט מהטופס):
 *  - חותך רווחים ומגביל אורך.
 *  - מסנן יתרונות/המלצות/תמונות ריקים.
 *  - מגביל את מספר הפריטים לפי המגבלות.
 * מחזיר null כשאין תוכן ממשי, כדי שנשמור NULL במסד הנתונים.
 */
export function normalizeLandingContent(raw: unknown): LandingContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;

  const heroEyebrow = cleanString(source.heroEyebrow, LIMITS.heroEyebrow);
  const heroHeadline = cleanString(source.heroHeadline, LIMITS.heroHeadline);
  const heroSubtext = cleanString(source.heroSubtext, LIMITS.heroSubtext);
  const about = cleanString(source.about, LIMITS.about);
  const ctaLabel = cleanString(source.ctaLabel, LIMITS.ctaLabel);

  const benefits: LandingBenefit[] = [];
  for (const item of toRecordArray(source.benefits)) {
    const title = cleanString(item.title, LIMITS.benefitTitle);
    const text = cleanString(item.text, LIMITS.benefitText);
    if (!title && !text) continue;
    benefits.push({ title, text });
    if (benefits.length >= MAX_BENEFITS) break;
  }

  const galleryImageUrls: string[] = [];
  const rawGallery = Array.isArray(source.galleryImageUrls) ? source.galleryImageUrls : [];
  for (const item of rawGallery) {
    const url = cleanString(item, LIMITS.galleryUrl);
    if (!url) continue;
    galleryImageUrls.push(url);
    if (galleryImageUrls.length >= MAX_GALLERY_IMAGES) break;
  }

  const beforeAfter: LandingBeforeAfter[] = [];
  for (const item of toRecordArray(source.beforeAfter)) {
    const beforeUrl = cleanString(item.beforeUrl, LIMITS.galleryUrl);
    const afterUrl = cleanString(item.afterUrl, LIMITS.galleryUrl);
    const label = cleanString(item.label, LIMITS.beforeAfterLabel);
    if (!beforeUrl || !afterUrl) continue; // זוג חייב שתי תמונות
    beforeAfter.push({ beforeUrl, afterUrl, label });
    if (beforeAfter.length >= MAX_BEFORE_AFTER) break;
  }

  const testimonials: LandingTestimonial[] = [];
  for (const item of toRecordArray(source.testimonials)) {
    const quote = cleanString(item.quote, LIMITS.testimonialQuote);
    const name = cleanString(item.name, LIMITS.testimonialName);
    if (!quote) continue; // המלצה חייבת ציטוט; שם אופציונלי
    testimonials.push({ name, quote });
    if (testimonials.length >= MAX_TESTIMONIALS) break;
  }

  const faq: LandingFaqItem[] = [];
  for (const item of toRecordArray(source.faq)) {
    const question = cleanString(item.question, LIMITS.faqQuestion);
    const answer = cleanString(item.answer, LIMITS.faqAnswer);
    if (!question || !answer) continue; // שאלה ותשובה חייבות להופיע יחד
    faq.push({ question, answer });
    if (faq.length >= MAX_FAQ) break;
  }

  const socialLinks = normalizeSocialLinks(source.socialLinks);
  const sections = normalizeSectionToggles(source.sections);

  const content: LandingContent = {};
  if (heroEyebrow) content.heroEyebrow = heroEyebrow;
  if (heroHeadline) content.heroHeadline = heroHeadline;
  if (heroSubtext) content.heroSubtext = heroSubtext;
  if (benefits.length) content.benefits = benefits;
  if (galleryImageUrls.length) content.galleryImageUrls = galleryImageUrls;
  if (beforeAfter.length) content.beforeAfter = beforeAfter;
  if (testimonials.length) content.testimonials = testimonials;
  if (faq.length) content.faq = faq;
  if (about) content.about = about;
  if (socialLinks) content.socialLinks = socialLinks;
  if (ctaLabel) content.ctaLabel = ctaLabel;
  if (sections) content.sections = sections;

  return Object.keys(content).length ? content : null;
}

/** מנרמל קישורי רשתות חברתיות; מחזיר null כשאין אף קישור תקין. */
function normalizeSocialLinks(value: unknown): LandingSocialLinks | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const result: LandingSocialLinks = {};
  const whatsapp = cleanString(source.whatsapp, LIMITS.socialUrl);
  const instagram = cleanString(source.instagram, LIMITS.socialUrl);
  const facebook = cleanString(source.facebook, LIMITS.socialUrl);
  const tiktok = cleanString(source.tiktok, LIMITS.socialUrl);
  if (whatsapp) result.whatsapp = whatsapp;
  if (instagram) result.instagram = instagram;
  if (facebook) result.facebook = facebook;
  if (tiktok) result.tiktok = tiktok;
  return Object.keys(result).length ? result : null;
}

/** מנרמל מפת הצגה/הסתרה של מקטעים; שומר רק מפתחות מוכרים עם ערך בוליאני. */
function normalizeSectionToggles(value: unknown): LandingSectionToggles | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const result: LandingSectionToggles = {};
  for (const key of LANDING_SECTION_ORDER) {
    const raw = source[key];
    if (typeof raw === 'boolean') result[key] = raw;
  }
  return Object.keys(result).length ? result : null;
}

/** האם תוכן עמוד הנחיתה ריק (או חסר) — שימושי כדי להחליט אם לשמור NULL. */
export function isLandingContentEmpty(content: LandingContent | null | undefined): boolean {
  return normalizeLandingContent(content ?? null) === null;
}

/** סוגי עסק שבהם "לפני / אחרי" מודלק כברירת מחדל (טרנספורמציה ויזואלית). */
const BEFORE_AFTER_DEFAULT_TYPES: ReadonlySet<BusinessTypeKey> = new Set([
  'BEAUTY_COSMETICS',
  'NAILS',
  'BROWS_LASHES',
  'TATTOO_PIERCING',
  'HAIR_SALON',
]);

/** מקטעים שדורשים תוכן ייעודי — יוסתרו אם אין להם תוכן, גם כשהם מודלקים. */
const CONTENT_REQUIRED_SECTIONS: ReadonlySet<LandingSectionKey> = new Set([
  'gallery',
  'beforeAfter',
  'testimonials',
  'faq',
  'about',
]);

/** ברירת המחדל של הדלקת/כיבוי מקטע לפי סוג העסק (לפני התאמות הבעלים). */
function defaultSectionEnabled(section: LandingSectionKey, type: BusinessTypeKey): boolean {
  if (section === 'hero') return true; // כותרת העמוד — תמיד מוצגת
  if (section === 'beforeAfter') return BEFORE_AFTER_DEFAULT_TYPES.has(type);
  if (section === 'faq') return false; // אופט-אין — מודלק כשממלאים שאלות
  return true; // highlights, services, gallery, testimonials, about, location, socialCta
}

/**
 * ברירת המחדל (לפני התאמות הבעלים) של הצגת מקטע לפי סוג העסק.
 * מיוצא לשימוש טופס הניהול — קובע את מצב תיבת הסימון ההתחלתי של כל מקטע,
 * וכן מאפשר למנתח הטופס לשמור רק בחירות שסוטות מברירת המחדל.
 */
export function landingSectionEnabledByDefault(
  section: LandingSectionKey,
  type?: string | null,
): boolean {
  return defaultSectionEnabled(section, (type ?? 'OTHER') as BusinessTypeKey);
}

/** האם למקטע תלוי-תוכן יש בפועל תוכן להצגה. */
function sectionHasContent(section: LandingSectionKey, content: LandingContent | null): boolean {
  if (!content) return false;
  switch (section) {
    case 'gallery':
      return Boolean(content.galleryImageUrls?.length);
    case 'beforeAfter':
      return Boolean(content.beforeAfter?.length);
    case 'testimonials':
      return Boolean(content.testimonials?.length);
    case 'faq':
      return Boolean(content.faq?.length);
    case 'about':
      return Boolean(content.about);
    default:
      return true;
  }
}

/** קלט לפתרון המקטעים המוצגים בעמוד הנחיתה. */
export interface ResolveLandingSectionsInput {
  content?: LandingContent | null;
  type?: string | null;
}

/**
 * מחזיר את רשימת מקטעי עמוד הנחיתה המוצגים, בסדר הקבוע:
 *  - מתחיל מברירת מחדל תלוית-סוג (למשל "לפני/אחרי" רק לסוגים ויזואליים, "שאלות נפוצות" באופט-אין).
 *  - מחיל את בחירות הבעלים (content.sections) מעל ברירת המחדל.
 *  - כופה שהכותרת (hero) תמיד מוצגת.
 *  - מסנן מקטעים תלויי-תוכן שאין להם תוכן ממשי.
 * פונקציה טהורה — ניתנת לבדיקה תחת ה-runner של הריפו.
 */
export function resolveLandingSections(input: ResolveLandingSectionsInput): LandingSectionKey[] {
  const content = input.content ?? null;
  const type = (input.type ?? 'OTHER') as BusinessTypeKey;
  const toggles = content?.sections ?? {};

  return LANDING_SECTION_ORDER.filter((section) => {
    if (section === 'hero') return true;
    const override = toggles[section];
    const enabled = typeof override === 'boolean' ? override : defaultSectionEnabled(section, type);
    if (!enabled) return false;
    if (CONTENT_REQUIRED_SECTIONS.has(section)) return sectionHasContent(section, content);
    return true;
  });
}
