// בדיקות יחידה למודול תוכן הקליניקה. מוודאות שהתוכן שנבנה שורד את
// normalizeLandingContent (נתיב הקריאה של page.tsx) ללא איבוד שדות, ושכל
// המכסות והמחירים נכונים.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLINIC_IDENTITY,
  CLINIC_SERVICES,
  buildClinicLandingContent,
} from './clinicDemo';
import { normalizeLandingContent } from '@/lib/publicPageStyle';

test('זהות העסק — ערכי הליבה', () => {
  assert.equal(CLINIC_IDENTITY.slug, 'skin-beauty');
  assert.equal(CLINIC_IDENTITY.brandColor, '#b0855f');
  assert.equal(CLINIC_IDENTITY.logoUrl, '/brand/business/skin-beauty.jpg');
  assert.equal(CLINIC_IDENTITY.coverImageUrl, '/images/clinic/banners/hero.jpg');
  assert.equal(CLINIC_IDENTITY.whatsapp, '972546755521');
  assert.equal(CLINIC_IDENTITY.address, 'הקישון 5, יבנה');
});

test('שירותים — עשרה טיפולים עם מחירים ומשכים תקינים', () => {
  assert.equal(CLINIC_SERVICES.length, 10);
  for (const s of CLINIC_SERVICES) {
    assert.ok(s.name.length > 0, 'שם טיפול לא ריק');
    assert.ok(s.description.length > 0, 'תיאור טיפול לא ריק');
    assert.ok(Number.isInteger(s.priceAgorot) && s.priceAgorot >= 0, 'מחיר שלם אי-שלילי');
    assert.ok(s.durationMin >= 30 && s.durationMin <= 60, 'משך בין 30 ל-60 דק');
    assert.ok(s.image.startsWith('/images/clinic/'), 'נתיב תמונה תחת /images/clinic');
  }
});

test('שירותים — הייעוץ עם מחיר מוסתר ומחיר אפס', () => {
  const consult = CLINIC_SERVICES.find((s) => s.name === 'ייעוץ והתאמה אישית');
  assert.ok(consult, 'קיים שירות ייעוץ');
  assert.equal(consult!.priceAgorot, 0);
  assert.equal(consult!.hidePrice, true);
});

test('landingContent — שורד את הנרמול ושומר על השדות החדשים', () => {
  const built = buildClinicLandingContent();
  const normalized = normalizeLandingContent(built);
  assert.ok(normalized, 'הנרמול לא מחזיר null');

  // שדות ליבה
  assert.equal(normalized!.heroHeadline, 'הסטנדרד החדש של עולם האסתטיקה');
  assert.ok(normalized!.heroSubtext && normalized!.heroSubtext.length > 0);

  // שדות אופציונליים חדשים — חייבים לשרוד את הנרמול
  assert.ok(Array.isArray(normalized!.heroImages));
  assert.equal(normalized!.heroImages!.length, 2);
  // רצועת העדכונים — טקסט ההכרזה חייב לשרוד את הנרמול ומזין את הפס הרץ בהירו הפרימיום.
  assert.ok(normalized!.announcement && normalized!.announcement.length > 0, 'announcement שורד');
  // פס מבצע ההשקה הוסר מברירת המחדל — הפרימיום מונע כעת מרצועת עדכונים ומ״מבצעים חמים״.
  assert.equal(normalized!.launchOffer, undefined, 'launchOffer אינו חלק מברירת המחדל');
  assert.ok(normalized!.hotDeals, 'hotDeals שורד');
  assert.equal(normalized!.hotDeals!.images.length, 6);
});

test('landingContent — וידאו הירו קיים ולפני/אחרי הוסר (דרישת פרימיום)', () => {
  const built = buildClinicLandingContent();
  const normalized = normalizeLandingContent(built);
  assert.ok(normalized, 'הנרמול לא מחזיר null');

  // וידאו הירו חייב לשרוד את הנרמול ולהיות תחת /images/clinic
  assert.ok(normalized!.heroVideoUrl, 'heroVideoUrl קיים');
  assert.ok(
    normalized!.heroVideoUrl!.startsWith('/images/clinic/'),
    'heroVideoUrl תחת /images/clinic',
  );
  assert.ok(normalized!.heroPosterUrl, 'heroPosterUrl קיים');
  assert.ok(
    normalized!.heroPosterUrl!.startsWith('/images/clinic/'),
    'heroPosterUrl תחת /images/clinic',
  );

  // סקשן לפני/אחרי הוסר מתוכן הקליניקה
  assert.equal((built.beforeAfter ?? []).length, 0, 'אין לפני/אחרי בתוכן הקליניקה');
  assert.equal(
    (normalized!.beforeAfter ?? []).length,
    0,
    'אין לפני/אחרי אחרי הנרמול',
  );
});

test('landingContent — כיבוד המכסות', () => {
  const c = buildClinicLandingContent();
  assert.ok((c.benefits ?? []).length <= 3, 'עד 3 יתרונות');
  assert.ok((c.galleryImageUrls ?? []).length <= 4, 'עד 4 תמונות גלריה');
  assert.ok((c.beforeAfter ?? []).length <= 3, 'עד 3 לפני/אחרי');
  assert.ok((c.heroImages ?? []).length <= 2, 'עד 2 תמונות הירו');
  assert.ok((c.hotDeals?.images ?? []).length <= 6, 'עד 6 תמונות לקובייה');
});

test('landingContent — קישורים חברתיים ממופים', () => {
  const c = buildClinicLandingContent();
  assert.equal(c.socialLinks?.whatsapp, '972546755521');
  assert.equal(c.socialLinks?.instagram, 'https://www.instagram.com/skin_b_clinic/');
  assert.ok(c.socialLinks?.facebook?.includes('facebook.com'));
});

test('landingContent — כל נתיבי התמונות תחת /images/clinic', () => {
  const c = buildClinicLandingContent();
  const urls = [
    ...(c.heroImages ?? []),
    ...(c.galleryImageUrls ?? []),
    ...(c.hotDeals?.images ?? []),
    ...((c.beforeAfter ?? []).flatMap((b) => [b.beforeUrl, b.afterUrl])),
  ];
  assert.ok(urls.length > 0);
  for (const u of urls) {
    assert.ok(u.startsWith('/images/clinic/'), `נתיב תחת /images/clinic: ${u}`);
  }
});
