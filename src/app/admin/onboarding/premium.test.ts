import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePremiumDraft, buildDefaultSectionToggles, BRAND_PRESETS } from './premium';

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
