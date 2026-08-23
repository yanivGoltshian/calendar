import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessOgModel } from './model';
import { resolveBrandColor, readableText } from '@/lib/brandColor';
import { BRAND } from '@/config/brand';

test('כשיש לוגו — mode הוא logo', () => {
  const model = buildBusinessOgModel({
    name: 'מספרת יוסי',
    logoUrl: 'data:image/png;base64,AAAA',
    brandColor: '#3366cc',
  });
  assert.equal(model.mode, 'logo');
});

test('כשיש גם לוגו וגם תמונת עסק — mode הוא logo (הלוגו גובר)', () => {
  const model = buildBusinessOgModel({
    name: 'מספרת יוסי',
    coverUrl: 'data:image/jpeg;base64,BBBB',
    logoUrl: 'data:image/png;base64,AAAA',
    brandColor: '#3366cc',
  });
  assert.equal(model.mode, 'logo');
});

test('יש תמונת עסק אך אין לוגו — mode הוא cover', () => {
  const model = buildBusinessOgModel({
    name: 'מספרת יוסי',
    coverUrl: 'data:image/jpeg;base64,BBBB',
    logoUrl: null,
    brandColor: '#3366cc',
  });
  assert.equal(model.mode, 'cover');
});

test('אין תמונת עסק אך יש לוגו — mode הוא logo', () => {
  const model = buildBusinessOgModel({
    name: 'מספרת יוסי',
    coverUrl: null,
    logoUrl: 'data:image/png;base64,AAAA',
    brandColor: '#3366cc',
  });
  assert.equal(model.mode, 'logo');
});

test('אין תמונת עסק ואין לוגו — mode הוא initial', () => {
  const model = buildBusinessOgModel({
    name: 'מספרת יוסי',
    coverUrl: null,
    logoUrl: null,
    brandColor: '#3366cc',
  });
  assert.equal(model.mode, 'initial');
  assert.equal(model.initial, 'מ');
});

test('תמונת עסק ריקה (מחרוזת ריקה) נחשבת כהיעדר — נפילה ללוגו', () => {
  const model = buildBusinessOgModel({
    name: 'Bella',
    coverUrl: '',
    logoUrl: 'data:image/png;base64,AAAA',
    brandColor: null,
  });
  assert.equal(model.mode, 'logo');
});

test('כשאין לוגו — mode הוא initial והאות היא התו הראשון של השם', () => {
  const model = buildBusinessOgModel({
    name: 'מספרת יוסי',
    logoUrl: null,
    brandColor: '#3366cc',
  });
  assert.equal(model.mode, 'initial');
  assert.equal(model.initial, 'מ');
});

test('לוגו ריק (מחרוזת ריקה) נחשב כהיעדר לוגו — נפילה לאות', () => {
  const model = buildBusinessOgModel({ name: 'Bella', logoUrl: '', brandColor: null });
  assert.equal(model.mode, 'initial');
  assert.equal(model.initial, 'B');
});

test('שם ריק — האות היא תו נקודה (•) כברירת מחדל', () => {
  const model = buildBusinessOgModel({ name: '   ', logoUrl: null, brandColor: '#123456' });
  assert.equal(model.initial, '\u2022');
});

test('צבע מותג תקין נפתר (ומוקטן לאותיות קטנות) ומזין את הרקע', () => {
  const model = buildBusinessOgModel({ name: 'X', logoUrl: null, brandColor: '#3366CC' });
  assert.equal(model.background, '#3366cc');
  assert.equal(model.background, resolveBrandColor('#3366CC'));
});

test('צבע מותג לא תקין נופל לצבע המותג של תור צ׳יק', () => {
  const model = buildBusinessOgModel({ name: 'X', logoUrl: null, brandColor: 'not-a-color' });
  assert.equal(model.background, BRAND.themeColor);
});

test('צבע הטקסט (fg) קריא מעל הרקע שנפתר', () => {
  const light = buildBusinessOgModel({ name: 'X', logoUrl: null, brandColor: '#ffffff' });
  assert.equal(light.fg, readableText('#ffffff'));
  assert.equal(light.fg, '#0A182D');

  const dark = buildBusinessOgModel({ name: 'X', logoUrl: null, brandColor: '#0A182D' });
  assert.equal(dark.fg, '#ffffff');
});

test('שדות undefined לגמרי — רקע נפילה, מצב אות ונקודה', () => {
  const model = buildBusinessOgModel({});
  assert.equal(model.background, BRAND.themeColor);
  assert.equal(model.mode, 'initial');
  assert.equal(model.initial, '\u2022');
});

test('תווית סוג העסק בעברית נגזרת מ-type', () => {
  const model = buildBusinessOgModel({ name: 'X', type: 'BARBERSHOP' });
  assert.equal(model.typeLabel, 'מספרה לגברים');
});

test("type ריק/לא ידוע/OTHER => כותרת משנה ריקה", () => {
  assert.equal(buildBusinessOgModel({ name: 'X' }).typeLabel, '');
  assert.equal(buildBusinessOgModel({ name: 'X', type: 'OTHER' }).typeLabel, '');
  assert.equal(buildBusinessOgModel({ name: 'X', type: 'NOPE' }).typeLabel, '');
});

test('הקריאה לפעולה קבועה — קביעת תור אונליין', () => {
  assert.equal(buildBusinessOgModel({ name: 'X' }).cta, 'קביעת תור אונליין');
});

test('שירותים — מסננים ריקים, גוזמים לשלושה ושומרים סדר', () => {
  const model = buildBusinessOgModel({
    name: 'X',
    services: ['תספורת', '  ', null, 'זקן', undefined, 'צבע', 'החלקה'],
  });
  assert.deepEqual(model.services, ['תספורת', 'זקן', 'צבע']);
});

test('בלי שירותים — מערך ריק', () => {
  assert.deepEqual(buildBusinessOgModel({ name: 'X' }).services, []);
});

test('name נשמר בסדר לוגי (ללא היפוך) במודל', () => {
  const model = buildBusinessOgModel({ name: 'מספרת יוסי' });
  assert.equal(model.name, 'מספרת יוסי');
});
