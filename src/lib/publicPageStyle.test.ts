import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sectionIconKey,
  landingDefaults,
  normalizeLandingContent,
  normalizePublicPageStyle,
  isLandingContentEmpty,
  MAX_BENEFITS,
  MAX_TESTIMONIALS,
  MAX_GALLERY_IMAGES,
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
