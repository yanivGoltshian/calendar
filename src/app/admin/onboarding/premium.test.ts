import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePremiumDraft,
  buildDefaultSectionToggles,
  BRAND_PRESETS,
  resolveInitialPremiumPhase,
  seedPremiumDraft,
  resolveOnboardingEntry,
  PREMIUM_WIZARD_STEPS,
  PREMIUM_WIZARD_TOTAL,
  PREMIUM_WIN_STEP,
  clampPremiumStep,
  nextPremiumStep,
  prevPremiumStep,
  isPremiumWinStep,
  premiumStepName,
  premiumStepIndex,
  premiumPipStatus,
} from './premium';

/**
 * בדיקות יחידה טהורות ללוגיקת תתי-שלבי הפרימיום.
 * מכסות ניתוח בטוח של טיוטת ה-JSON וזריעת מצב המקטעים ההתחלתי.
 */

test('parsePremiumDraft: קלט שאינו מחרוזת מחזיר null', () => {
  assert.equal(parsePremiumDraft(null), null);
  assert.equal(parsePremiumDraft(undefined), null);
  assert.equal(parsePremiumDraft(42), null);
  assert.equal(parsePremiumDraft({ heroHeadline: 'x' }), null);
});

test('parsePremiumDraft: מחרוזת ריקה או רווחים בלבד מחזירה null', () => {
  assert.equal(parsePremiumDraft(''), null);
  assert.equal(parsePremiumDraft('   '), null);
});

test('parsePremiumDraft: JSON פגום מחזיר null במקום לזרוק', () => {
  assert.equal(parsePremiumDraft('{lo:'), null);
  assert.equal(parsePremiumDraft('not json at all'), null);
});

test('parsePremiumDraft: אובייקט ריק לאחר נרמול מחזיר null', () => {
  assert.equal(parsePremiumDraft('{}'), null);
  // שדות ריקים בלבד — הנרמול משמיט אותם ומחזיר null
  assert.equal(parsePremiumDraft('{"heroHeadline":"   ","about":""}'), null);
});

test('parsePremiumDraft: תוכן תקין עובר נרמול, קיטום רווחים ומיפוי שדות', () => {
  const raw = JSON.stringify({
    heroEyebrow: '  סטודיו בוטיק  ',
    heroHeadline: 'חוויה שמרגישים',
    about: '  קצת עלינו  ',
    ctaLabel: 'לקביעת תור',
  });
  const result = parsePremiumDraft(raw);
  assert.ok(result);
  assert.equal(result?.heroEyebrow, 'סטודיו בוטיק');
  assert.equal(result?.heroHeadline, 'חוויה שמרגישים');
  assert.equal(result?.about, 'קצת עלינו');
  assert.equal(result?.ctaLabel, 'לקביעת תור');
});

test('parsePremiumDraft: מסנן פריטים ריקים ואוכף מגבלות דרך הנרמול', () => {
  const raw = JSON.stringify({
    benefits: [
      { title: 'שירות אישי', text: 'יחס חם' },
      { title: '', text: '' }, // ריק — יסונן
      { title: 'איכות', text: '' },
      { title: 'ניסיון', text: 'שנים בתחום' },
      { title: 'עודף', text: 'מעבר למגבלה' }, // מעבר ל-MAX_BENEFITS=3
    ],
    beforeAfter: [
      { beforeUrl: 'https://a/1.jpg', afterUrl: 'https://a/2.jpg', label: 'טיפול' },
      { beforeUrl: 'https://a/3.jpg', afterUrl: '', label: 'חסר אחרי' }, // זוג לא שלם — יסונן
    ],
    faq: [
      { question: 'שאלה', answer: 'תשובה' },
      { question: 'רק שאלה', answer: '' }, // חצי — יסונן
    ],
  });
  const result = parsePremiumDraft(raw);
  assert.ok(result);
  assert.equal(result?.benefits?.length, 3); // אוכף MAX_BENEFITS ומסנן ריקים
  assert.equal(result?.beforeAfter?.length, 1); // רק הזוג השלם נשמר
  assert.equal(result?.faq?.length, 1); // רק שאלה+תשובה מלאות נשמרות
});

test('buildDefaultSectionToggles: כולל את כל המקטעים הניתנים לכיבוי ולא את hero', () => {
  const toggles = buildDefaultSectionToggles('OTHER');
  assert.equal(Object.prototype.hasOwnProperty.call(toggles, 'hero'), false);
  assert.equal(typeof toggles.services, 'boolean');
  assert.equal(typeof toggles.gallery, 'boolean');
  assert.equal(typeof toggles.socialCta, 'boolean');
});

test('buildDefaultSectionToggles: לפני/אחרי מודלק בסוג ויזואלי וכבוי באחר', () => {
  assert.equal(buildDefaultSectionToggles('NAILS').beforeAfter, true);
  assert.equal(buildDefaultSectionToggles('OTHER').beforeAfter, false);
});

test('buildDefaultSectionToggles: שאלות נפוצות כבויות כברירת מחדל (אופט-אין)', () => {
  assert.equal(buildDefaultSectionToggles('OTHER').faq, false);
  assert.equal(buildDefaultSectionToggles('NAILS').faq, false);
});

test('buildDefaultSectionToggles: סוג לא ידוע נופל להתנהגות OTHER', () => {
  const unknown = buildDefaultSectionToggles('NOT_A_TYPE');
  const other = buildDefaultSectionToggles('OTHER');
  assert.deepEqual(unknown, other);
});

/* ── פלטת המותג (theme) ── */

test('theme: פלטה שכל שמונת הגוונים תקינים נשמרת כמו שהיא', () => {
  const theme = {
    brand: '#b0855f',
    brandDark: '#8c6748',
    gold: '#c6a86a',
    goldStrong: '#a6863f',
    goldText: '#8c6748',
    cream: '#faf6ef',
    ink: '#1b1715',
    accent: '#c08f86',
  };
  const result = parsePremiumDraft(JSON.stringify({ heroHeadline: 'שלום', theme }));
  assert.ok(result);
  assert.deepEqual(result?.theme, theme);
});

test('theme: ערך גוון אחד לא-תקין משמיט את כל הפלטה', () => {
  const theme = {
    brand: 'red', // לא hex בן שש ספרות — כל הפלטה מושמטת
    brandDark: '#8c6748',
    gold: '#c6a86a',
    goldStrong: '#a6863f',
    goldText: '#8c6748',
    cream: '#faf6ef',
    ink: '#1b1715',
    accent: '#c08f86',
  };
  const result = parsePremiumDraft(JSON.stringify({ heroHeadline: 'שלום', theme }));
  assert.ok(result);
  assert.equal(result?.theme, undefined);
});

test('theme: פלטה חלקית (שדה חסר) מושמטת לגמרי', () => {
  const theme = { brand: '#b0855f', brandDark: '#8c6748' }; // חסרים שישה תפקידים
  const result = parsePremiumDraft(JSON.stringify({ heroHeadline: 'שלום', theme }));
  assert.ok(result);
  assert.equal(result?.theme, undefined);
});

test('BRAND_PRESETS: קיימות שתים-עשרה פלטות עם מזהים ייחודיים', () => {
  assert.equal(BRAND_PRESETS.length, 12);
  const ids = new Set(BRAND_PRESETS.map((p) => p.id));
  assert.equal(ids.size, 12);
});

test('BRAND_PRESETS: כל פלטה אצורה שורדת את הנרמול עם theme זהה', () => {
  const hex = /^#[0-9a-fA-F]{6}$/;
  for (const preset of BRAND_PRESETS) {
    // כל שמונת התפקידים חייבים להיות hex תקין כדי לשרוד את normalizeLandingTheme
    for (const value of Object.values(preset.theme)) {
      assert.match(value, hex, `${preset.id}: גוון לא תקין ${value}`);
    }
    const result = parsePremiumDraft(JSON.stringify({ heroHeadline: 'x', theme: preset.theme }));
    assert.ok(result, `${preset.id}: הנרמול החזיר null`);
    assert.deepEqual(result?.theme, preset.theme, `${preset.id}: theme השתנה בנרמול`);
  }
});

/* ── מבצע השקה (launchOffer) ── */

test('launchOffer: text + endsAt תקינים נשמרים, spotsLeft נגזר', () => {
  const raw = JSON.stringify({
    heroHeadline: 'x',
    launchOffer: { text: '20% הנחה', endsAt: '2099-12-31', spotsLeft: 5.7 },
  });
  const result = parsePremiumDraft(raw);
  assert.ok(result?.launchOffer);
  assert.equal(result?.launchOffer?.text, '20% הנחה');
  assert.equal(result?.launchOffer?.endsAt, '2099-12-31');
  assert.equal(result?.launchOffer?.spotsLeft, 5); // Math.floor
});

test('launchOffer: חסר endsAt או מועד פגום משמיט את המבצע', () => {
  const missing = parsePremiumDraft(JSON.stringify({ heroHeadline: 'x', launchOffer: { text: 'מבצע' } }));
  assert.ok(missing);
  assert.equal(missing?.launchOffer, undefined);
  const bad = parsePremiumDraft(
    JSON.stringify({ heroHeadline: 'x', launchOffer: { text: 'מבצע', endsAt: 'לא-תאריך' } }),
  );
  assert.ok(bad);
  assert.equal(bad?.launchOffer, undefined);
});

/* ── מבצעים חמים (hotDeals) ── */

test('hotDeals: דורש לפחות תמונה אחת, אחרת מושמט', () => {
  const empty = parsePremiumDraft(
    JSON.stringify({ heroHeadline: 'x', hotDeals: { title: 'מבצעים', images: [] } }),
  );
  assert.ok(empty);
  assert.equal(empty?.hotDeals, undefined);
});

test('hotDeals: עם תמונה נשמר עם שדות הטקסט האופציונליים', () => {
  const raw = JSON.stringify({
    heroHeadline: 'x',
    hotDeals: { eyebrow: 'לזמן מוגבל', title: 'המבצעים שלנו', images: ['https://a/1.jpg'] },
  });
  const result = parsePremiumDraft(raw);
  assert.ok(result?.hotDeals);
  assert.equal(result?.hotDeals?.images.length, 1);
  assert.equal(result?.hotDeals?.title, 'המבצעים שלנו');
  assert.equal(result?.hotDeals?.eyebrow, 'לזמן מוגבל');
});

/* ── תמונות הירו (heroImages) ── */

test('heroImages: נחתך לשתי תמונות לכל היותר', () => {
  const raw = JSON.stringify({
    heroHeadline: 'x',
    heroImages: ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'],
  });
  const result = parsePremiumDraft(raw);
  assert.ok(result?.heroImages);
  assert.equal(result?.heroImages?.length, 2);
});

/* ── WAVE D: לכידת תוכן חברתי (instagramPostUrls / socialVideoUrls / facebookFeedUrl) ── */

test('WAVE D: שלושת שדות הרשתות עוברים סבב מלא דרך parsePremiumDraft עם סינון וקיטום', () => {
  const raw = JSON.stringify({
    heroHeadline: 'x',
    instagramPostUrls: [
      'https://example.com/not-instagram', // לא אינסטגרם — יסונן
      'https://instagram.com/p/AAA1/',
      'https://instagram.com/reel/BBB2/',
      'https://instagram.com/p/CCC3/',
      'https://instagram.com/p/DDD4/',
      'https://instagram.com/p/EEE5/',
      'https://instagram.com/p/FFF6/',
      'https://instagram.com/p/GGG7/', // מעבר לתקרה 6 — יקוצץ
    ],
    socialVideoUrls: [
      'https://www.tiktok.com/@u/video/123',
      'not a url', // יסונן
      'https://youtu.be/abc',
    ],
    facebookFeedUrl: 'https://facebook.com/mypage',
    socialLinks: { facebook: 'https://facebook.com/icononly' },
  });
  const result = parsePremiumDraft(raw);
  assert.ok(result);
  // סינון (לא-אינסטגרם הושמט) + תקרה של שישה
  assert.equal(result?.instagramPostUrls?.length, 6);
  assert.equal(result?.instagramPostUrls?.[0], 'https://instagram.com/p/AAA1/');
  // רק שתי כתובות http(s) נשמרות
  assert.equal(result?.socialVideoUrls?.length, 2);
  // פיד הפייסבוק המפורש נשמר
  assert.equal(result?.facebookFeedUrl, 'https://facebook.com/mypage');
  // כפתור האייקון נשאר נפרד ולא נגזר לפיד (משמר את הניתוק מ-C.1)
  assert.equal(result?.socialLinks?.facebook, 'https://facebook.com/icononly');
});

test('WAVE D: אינווריאנט C.1 — socialLinks.facebook לבדו אינו מזין facebookFeedUrl', () => {
  // רק כפתור האייקון קיים, ללא facebookFeedUrl מפורש → הפיד לא נדלק
  const iconOnly = parsePremiumDraft(
    JSON.stringify({ heroHeadline: 'x', socialLinks: { facebook: 'https://facebook.com/icononly' } }),
  );
  assert.ok(iconOnly);
  assert.equal(iconOnly?.facebookFeedUrl, undefined);
  assert.equal(iconOnly?.socialLinks?.facebook, 'https://facebook.com/icononly');
  // facebookFeedUrl שאינו facebook.com מושמט
  const nonFacebook = parsePremiumDraft(
    JSON.stringify({ heroHeadline: 'x', facebookFeedUrl: 'https://instagram.com/p/AAA1/' }),
  );
  assert.ok(nonFacebook);
  assert.equal(nonFacebook?.facebookFeedUrl, undefined);
});

/**
 * כניסה ישירה לעורך (deep-link ‎?edit=premium‎) מול הזרימה הקלאסית.
 * resolveInitialPremiumPhase הוא הלוגיקה שמאתחלת את premiumPhase באשף:
 * 'editor' ⇐ העורך נפתח מיד; אחרת null ⇐ שלושת הצעדים הרגילים.
 */
test('resolveInitialPremiumPhase: כניסה ישירה עם "editor" פותחת את העורך מיד', () => {
  assert.equal(resolveInitialPremiumPhase('editor'), 'editor');
});

test('resolveInitialPremiumPhase: ללא prop (זרימה רגילה) מתחילים בשלבים הקלאסיים (null)', () => {
  assert.equal(resolveInitialPremiumPhase(undefined), null);
  assert.equal(resolveInitialPremiumPhase(), null);
});

test('seedPremiumDraft: זריעה מתוכן קיים מחזירה בדיוק את אותו אובייקט (העורך נטען מלא)', () => {
  const existing = { heroHeadline: 'חוויה שמרגישים', about: 'קצת עלינו' };
  assert.equal(seedPremiumDraft(existing), existing);
});

test('seedPremiumDraft: ללא תוכן קיים (null/undefined) מחזירה טיוטה ריקה', () => {
  assert.deepEqual(seedPremiumDraft(null), {});
  assert.deepEqual(seedPremiumDraft(undefined), {});
});

/**
 * תיקון הפלואו "מתחיל מהתחלה": עסק שכבר סיים את ההקמה הבסיסית נכנס ישר לעורך הפרימיום,
 * בלי לחזור על שירותים → שעות → מיתוג. resolveOnboardingEntry משלב deep-link מפורש
 * עם settings.onboardingCompleted ועם basicSetupComplete (הקמה מוגדרת בפועל), ומשמר
 * את הזרימה הרגילה של עסק חדש.
 */
test('resolveOnboardingEntry: deep-link מפורש פותח את העורך תמיד', () => {
  assert.equal(resolveOnboardingEntry({ editParam: 'premium' }), 'editor');
  assert.equal(resolveOnboardingEntry({ phaseParam: 'editor' }), 'editor');
  // גם כשההקמה לא הושלמה — הכוונה המפורשת גוברת
  assert.equal(
    resolveOnboardingEntry({ editParam: 'premium', onboardingCompleted: false }),
    'editor',
  );
});

test('resolveOnboardingEntry: עסק שסיים הקמה נוחת ישר בעורך גם בלי deep-link', () => {
  assert.equal(resolveOnboardingEntry({ onboardingCompleted: true }), 'editor');
});

test('resolveOnboardingEntry: עסק שהוגדר בפועל (שירותים+שעות+מיתוג) נוחת בעורך גם בלי דגל', () => {
  // basicSetupComplete מכסה עסק שהוגדר דרך עמודי האדמין בלי לסגור את דגל ההקמה,
  // כדי שלא יופל שוב לשלב הראשון של האשף הבסיסי.
  assert.equal(resolveOnboardingEntry({ basicSetupComplete: true }), 'editor');
  assert.equal(
    resolveOnboardingEntry({ onboardingCompleted: false, basicSetupComplete: true }),
    'editor',
  );
});

test('resolveOnboardingEntry: עסק חדש בלי deep-link שומר על הזרימה הרגילה (undefined)', () => {
  assert.equal(resolveOnboardingEntry({}), undefined);
  assert.equal(resolveOnboardingEntry({ onboardingCompleted: false }), undefined);
  assert.equal(resolveOnboardingEntry({ basicSetupComplete: false }), undefined);
  assert.equal(
    resolveOnboardingEntry({ onboardingCompleted: false, basicSetupComplete: false }),
    undefined,
  );
  assert.equal(resolveOnboardingEntry({ editParam: 'other', phaseParam: 'gate' }), undefined);
  assert.equal(resolveOnboardingEntry({ editParam: null, phaseParam: null, onboardingCompleted: null }), undefined);
});

/**
 * אשף חמשת השלבים בתוך מסגרת הטלפון (המוקאפ המאושר premium-builder.html).
 * בדיקות טהורות ללוגיקת הניווט: קיבוע טווח, המשך/חזרה, זיהוי מסך הסיום,
 * מיפוי שם⇄מספר שלב, ומצב ה-pips. אלו מגבות את שכבת ה-UI של האשף.
 */
test('PREMIUM_WIZARD_STEPS: חמישה שלבים בסדר הנכון + קבועים נגזרים', () => {
  assert.deepEqual([...PREMIUM_WIZARD_STEPS], ['gallery', 'social', 'deals', 'about', 'why']);
  assert.equal(PREMIUM_WIZARD_TOTAL, 5);
  assert.equal(PREMIUM_WIN_STEP, 6);
});

test('clampPremiumStep: מקבע לטווח 1..6 וממפה קלט לא-חוקי ל-1', () => {
  assert.equal(clampPremiumStep(0), 1);
  assert.equal(clampPremiumStep(-3), 1);
  assert.equal(clampPremiumStep(1), 1);
  assert.equal(clampPremiumStep(6), 6);
  assert.equal(clampPremiumStep(9), 6);
  assert.equal(clampPremiumStep(3.7), 3);
  assert.equal(clampPremiumStep(Number.NaN), 1);
});

test('nextPremiumStep: מתקדם שלב אחד ונעצר במסך הסיום (6)', () => {
  assert.equal(nextPremiumStep(1), 2);
  assert.equal(nextPremiumStep(4), 5);
  assert.equal(nextPremiumStep(5), 6);
  assert.equal(nextPremiumStep(6), 6);
});

test('prevPremiumStep: חוזר שלב אחד ולא לפני שלב 1', () => {
  assert.equal(prevPremiumStep(6), 5);
  assert.equal(prevPremiumStep(2), 1);
  assert.equal(prevPremiumStep(1), 1);
});

test('isPremiumWinStep: אמת רק עבור מסך הסיום (6)', () => {
  assert.equal(isPremiumWinStep(6), true);
  assert.equal(isPremiumWinStep(5), false);
  assert.equal(isPremiumWinStep(1), false);
});

test('premiumStepName: ממפה 1..5 לשמות ומחזיר null במסך הסיום', () => {
  assert.equal(premiumStepName(1), 'gallery');
  assert.equal(premiumStepName(2), 'social');
  assert.equal(premiumStepName(3), 'deals');
  assert.equal(premiumStepName(4), 'about');
  assert.equal(premiumStepName(5), 'why');
  assert.equal(premiumStepName(6), null);
});

test('premiumStepIndex: מיפוי הפוך שם⇄מספר, לניווט «עריכה» ממסך הסיום', () => {
  assert.equal(premiumStepIndex('gallery'), 1);
  assert.equal(premiumStepIndex('social'), 2);
  assert.equal(premiumStepIndex('deals'), 3);
  assert.equal(premiumStepIndex('about'), 4);
  assert.equal(premiumStepIndex('why'), 5);
  // round-trip: name → index → name
  for (const name of PREMIUM_WIZARD_STEPS) {
    assert.equal(premiumStepName(premiumStepIndex(name)), name);
  }
});

test('premiumPipStatus: מסמן שלבים שהושלמו/נוכחי/עתידי לפי השלב הנוכחי', () => {
  // בשלב 3: 1-2 הושלמו, 3 נוכחי, 4-5 עתידיים
  assert.equal(premiumPipStatus(1, 3), 'done');
  assert.equal(premiumPipStatus(2, 3), 'done');
  assert.equal(premiumPipStatus(3, 3), 'cur');
  assert.equal(premiumPipStatus(4, 3), 'todo');
  assert.equal(premiumPipStatus(5, 3), 'todo');
});
