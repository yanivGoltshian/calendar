import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sectionIconKey,
  landingDefaults,
  normalizeLandingContent,
  normalizePublicPageStyle,
  isLandingContentEmpty,
  resolveLandingSections,
  LANDING_SECTION_ORDER,
  TOGGLEABLE_LANDING_SECTIONS,
  MAX_BENEFITS,
  MAX_TESTIMONIALS,
  MAX_GALLERY_IMAGES,
  MAX_FAQ,
  MAX_BEFORE_AFTER,
} from './publicPageStyle';

test('sectionIconKey: ממפה כל סוג עסק לאייקון הנכון', () => {
  assert.equal(sectionIconKey('FITNESS'), 'dumbbell');
  assert.equal(sectionIconKey('CLINIC'), 'stethoscope');
  assert.equal(sectionIconKey('SPA_MASSAGE'), 'leaf');
  assert.equal(sectionIconKey('NAILS'), 'sparkle');
  assert.equal(sectionIconKey('BROWS_LASHES'), 'eye');
  assert.equal(sectionIconKey('TATTOO_PIERCING'), 'needle');
  assert.equal(sectionIconKey('BEAUTY_COSMETICS'), 'sparkles');
  assert.equal(sectionIconKey('BARBERSHOP'), 'scissors');
  assert.equal(sectionIconKey('HAIR_SALON'), 'scissors');
});

test('sectionIconKey: סוג חסר או לא ידוע ⇐ לוח שנה (calendar)', () => {
  assert.equal(sectionIconKey('OTHER'), 'calendar');
  assert.equal(sectionIconKey(null), 'calendar');
  assert.equal(sectionIconKey(undefined), 'calendar');
  assert.equal(sectionIconKey('SOMETHING_ELSE'), 'calendar');
  assert.equal(sectionIconKey(''), 'calendar');
});

test('landingDefaults: מחזיר ברירות מחדל תלויות-סוג עם שלושה יתרונות', () => {
  const fit = landingDefaults('FITNESS');
  assert.equal(fit.heroHeadline, 'כושר שמביא תוצאות');
  assert.equal(fit.benefits.length, 3);
  for (const b of fit.benefits) {
    assert.ok(b.title.length > 0);
    assert.ok(b.text.length > 0);
  }

  const clinic = landingDefaults('CLINIC');
  assert.notEqual(clinic.heroHeadline, fit.heroHeadline);
  assert.equal(clinic.benefits.length, 3);
});

test('landingDefaults: סוג חסר או לא ידוע ⇐ עותק גנרי (OTHER)', () => {
  const other = landingDefaults('OTHER');
  assert.deepEqual(landingDefaults(null), other);
  assert.deepEqual(landingDefaults(undefined), other);
  assert.deepEqual(landingDefaults('NOPE'), other);
});

test('normalizePublicPageStyle: LANDING נשמר, כל השאר ⇐ BOOKING', () => {
  assert.equal(normalizePublicPageStyle('LANDING'), 'LANDING');
  assert.equal(normalizePublicPageStyle('BOOKING'), 'BOOKING');
  assert.equal(normalizePublicPageStyle('booking'), 'BOOKING');
  assert.equal(normalizePublicPageStyle('garbage'), 'BOOKING');
  assert.equal(normalizePublicPageStyle(null), 'BOOKING');
  assert.equal(normalizePublicPageStyle(undefined), 'BOOKING');
});

test('normalizeLandingContent: קלט ריק/לא-אובייקט ⇐ null', () => {
  assert.equal(normalizeLandingContent(null), null);
  assert.equal(normalizeLandingContent(undefined), null);
  assert.equal(normalizeLandingContent('hi'), null);
  assert.equal(normalizeLandingContent(42), null);
  assert.equal(normalizeLandingContent({}), null);
  assert.equal(normalizeLandingContent({ heroHeadline: '   ' }), null);
});

test('normalizeLandingContent: חותך רווחים ומשמר שדות מלאים', () => {
  const res = normalizeLandingContent({
    heroHeadline: '  שלום  ',
    heroSubtext: ' תת כותרת ',
    benefits: [{ title: ' א ', text: ' טקסט ' }],
    galleryImageUrls: [' https://x/1.jpg ', ''],
    testimonials: [{ name: ' דנה ', quote: ' מעולה ' }],
  });
  assert.ok(res);
  if (!res) return;
  assert.equal(res.heroHeadline, 'שלום');
  assert.equal(res.heroSubtext, 'תת כותרת');
  assert.deepEqual(res.benefits, [{ title: 'א', text: 'טקסט' }]);
  assert.deepEqual(res.galleryImageUrls, ['https://x/1.jpg']);
  assert.deepEqual(res.testimonials, [{ name: 'דנה', quote: 'מעולה' }]);
});

test('normalizeLandingContent: מסנן שורות ריקות ומגביל כמויות', () => {
  const res = normalizeLandingContent({
    benefits: [
      { title: 'a', text: '' },
      { title: '', text: '' }, // ריק — יורד
      { title: 'b', text: 'b' },
      { title: 'c', text: 'c' },
      { title: 'd', text: 'd' }, // מעבר לתקרה — נחתך
    ],
    galleryImageUrls: ['1', '', '2', '3', '4', '5'],
    testimonials: [
      { name: 'ללא ציטוט', quote: '' }, // חייב ציטוט — יורד
      { name: '', quote: 'ציטוט בלי שם' }, // שם אופציונלי — נשמר
      { name: 'x', quote: 'y' },
      { name: 'z', quote: 'z' },
      { name: 'w', quote: 'w' }, // מעבר לתקרה — נחתך
    ],
  });
  assert.ok(res);
  if (!res) return;
  assert.equal(res.benefits?.length, MAX_BENEFITS);
  assert.equal(res.galleryImageUrls?.length, MAX_GALLERY_IMAGES);
  assert.equal(res.testimonials?.length, MAX_TESTIMONIALS);
  assert.equal(res.testimonials?.[0].name, '');
  assert.equal(res.testimonials?.[0].quote, 'ציטוט בלי שם');
});

test('isLandingContentEmpty: מזהה תוכן ריק מול תוכן ממשי', () => {
  assert.equal(isLandingContentEmpty(null), true);
  assert.equal(isLandingContentEmpty(undefined), true);
  assert.equal(isLandingContentEmpty({}), true);
  assert.equal(isLandingContentEmpty({ benefits: [] }), true);
  assert.equal(isLandingContentEmpty({ heroHeadline: 'יש' }), false);
});

test('normalizeLandingContent: מנרמל שדות עשירים (faq, לפני/אחרי, אודות, רשתות, CTA)', () => {
  const res = normalizeLandingContent({
    heroEyebrow: ' סטודיו יופי ',
    about: '  קצת עלינו  ',
    ctaLabel: ' לקביעת תור ',
    faq: [
      { question: ' שאלה ', answer: ' תשובה ' },
      { question: 'רק שאלה', answer: '' }, // חסר תשובה — יורד
    ],
    beforeAfter: [
      { beforeUrl: ' https://x/b.jpg ', afterUrl: ' https://x/a.jpg ', label: ' טיפול ' },
      { beforeUrl: 'https://x/b2.jpg', afterUrl: '' }, // חסר after — יורד
    ],
    socialLinks: { whatsapp: ' https://wa.me/1 ', instagram: '', tiktok: 'https://tt/x' },
  });
  assert.ok(res);
  if (!res) return;
  assert.equal(res.heroEyebrow, 'סטודיו יופי');
  assert.equal(res.about, 'קצת עלינו');
  assert.equal(res.ctaLabel, 'לקביעת תור');
  assert.deepEqual(res.faq, [{ question: 'שאלה', answer: 'תשובה' }]);
  assert.deepEqual(res.beforeAfter, [
    { beforeUrl: 'https://x/b.jpg', afterUrl: 'https://x/a.jpg', label: 'טיפול' },
  ]);
  assert.deepEqual(res.socialLinks, { whatsapp: 'https://wa.me/1', tiktok: 'https://tt/x' });
});

test('normalizeLandingContent: מגביל כמויות של faq ולפני/אחרי', () => {
  const res = normalizeLandingContent({
    faq: Array.from({ length: MAX_FAQ + 2 }, (_, i) => ({ question: `ש${i}`, answer: `ת${i}` })),
    beforeAfter: Array.from({ length: MAX_BEFORE_AFTER + 2 }, (_, i) => ({
      beforeUrl: `https://x/b${i}.jpg`,
      afterUrl: `https://x/a${i}.jpg`,
      label: `${i}`,
    })),
  });
  assert.ok(res);
  if (!res) return;
  assert.equal(res.faq?.length, MAX_FAQ);
  assert.equal(res.beforeAfter?.length, MAX_BEFORE_AFTER);
});

test('normalizeLandingContent: שומר רק מתגי מקטע מוכרים עם ערך בוליאני', () => {
  const res = normalizeLandingContent({
    heroHeadline: 'יש',
    sections: { faq: true, gallery: false, bogus: true, about: 'notbool' },
  });
  assert.ok(res);
  if (!res) return;
  assert.deepEqual(res.sections, { gallery: false, faq: true });
});

test('resolveLandingSections: ברירת מחדל — hero תמיד, faq כבוי, לפני/אחרי לפי סוג', () => {
  // סוג ויזואלי (NAILS): beforeAfter דלוק כברירת מחדל, אבל דורש תוכן ⇒ מוסתר בלי תוכן
  const nails = resolveLandingSections({ type: 'NAILS', content: null });
  assert.ok(nails.includes('hero'));
  assert.ok(nails.includes('services'));
  assert.ok(nails.includes('location'));
  assert.ok(!nails.includes('faq')); // אופט-אין
  assert.ok(!nails.includes('beforeAfter')); // דלוק אך חסר תוכן
  assert.ok(!nails.includes('gallery')); // חסר תוכן

  // סוג לא-ויזואלי (CLINIC): beforeAfter כבוי כברירת מחדל
  const clinicToggles = resolveLandingSections({
    type: 'CLINIC',
    content: {
      beforeAfter: [{ beforeUrl: 'https://x/b.jpg', afterUrl: 'https://x/a.jpg', label: '' }],
    },
  });
  assert.ok(!clinicToggles.includes('beforeAfter')); // כבוי כברירת מחדל למרות שיש תוכן
});

test('resolveLandingSections: בחירות הבעלים גוברות על ברירת המחדל', () => {
  // הדלקת faq עם תוכן ⇒ מוצג
  const withFaq = resolveLandingSections({
    type: 'OTHER',
    content: { sections: { faq: true }, faq: [{ question: 'ש', answer: 'ת' }] },
  });
  assert.ok(withFaq.includes('faq'));

  // כיבוי services ידנית ⇒ מוסתר
  const noServices = resolveLandingSections({
    type: 'OTHER',
    content: { sections: { services: false } },
  });
  assert.ok(!noServices.includes('services'));

  // כיבוי hero לא אפשרי — תמיד מוצג
  const noHero = resolveLandingSections({
    type: 'OTHER',
    content: { sections: { hero: false } },
  });
  assert.ok(noHero.includes('hero'));
});

test('resolveLandingSections: שומר על הסדר הקבוע של LANDING_SECTION_ORDER', () => {
  const res = resolveLandingSections({
    type: 'BEAUTY_COSMETICS',
    content: {
      sections: { faq: true },
      galleryImageUrls: ['https://x/1.jpg'],
      beforeAfter: [{ beforeUrl: 'https://x/b.jpg', afterUrl: 'https://x/a.jpg', label: '' }],
      testimonials: [{ name: '', quote: 'מעולה' }],
      faq: [{ question: 'ש', answer: 'ת' }],
      about: 'עלינו',
    },
  });
  const indices = res.map((s) => LANDING_SECTION_ORDER.indexOf(s));
  const sorted = [...indices].sort((a, b) => a - b);
  assert.deepEqual(indices, sorted);
  // כל המקטעים העשירים מודלקים לסוג ויזואלי עם תוכן מלא
  assert.deepEqual(res, LANDING_SECTION_ORDER);
});

test('TOGGLEABLE_LANDING_SECTIONS: כולל את כל המקטעים פרט ל-hero', () => {
  assert.ok(!TOGGLEABLE_LANDING_SECTIONS.includes('hero'));
  assert.equal(TOGGLEABLE_LANDING_SECTIONS.length, LANDING_SECTION_ORDER.length - 1);
});
