import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMediaFile,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from './validate';

/**
 * מבחני ולידציה טהורים למסלול ההעלאה `src/app/api/upload/media/route.ts`.
 *
 * למה מבחן על `validateMediaFile` ולא ייבוא ישיר של ה-handler:
 * ה-handler הוא server-only (קורא ל-`auth()`, ל-Prisma ול-`@azure/storage-blob`),
 * ולכן בהתאם לדפוס של `src/app/api/book/route.contract.test.ts` בודקים את פונקציית
 * הולידציה הטהורה שהמסלול עצמו קורא לה, בלי לשכפל לוגיקה ובלי לטעון תלויות שרת.
 * ההסתעפות type/size נעולה כאן; שער הבעלות (401/403) מכוסה התנהגותית במסלול.
 */

test('תמונה תקינה (jpeg) בגודל סביר מתקבלת עם סיומת וקטגוריה', () => {
  const r = validateMediaFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.ext, 'jpg');
    assert.equal(r.kind, 'image');
  }
});

test('כל סוגי התמונה המותרים ממופים לסיומת הנכונה', () => {
  assert.deepEqual(validateMediaFile({ type: 'image/png', size: 1024 }), {
    ok: true,
    ext: 'png',
    kind: 'image',
  });
  assert.deepEqual(validateMediaFile({ type: 'image/webp', size: 1024 }), {
    ok: true,
    ext: 'webp',
    kind: 'image',
  });
});

test('סרטון תקין (mp4) בגודל סביר מתקבל עם סיומת וקטגוריה', () => {
  const r = validateMediaFile({ type: 'video/mp4', size: 20 * 1024 * 1024 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.ext, 'mp4');
    assert.equal(r.kind, 'video');
  }
});

test('סרטון webm תקין מתקבל', () => {
  assert.deepEqual(validateMediaFile({ type: 'video/webm', size: 1024 }), {
    ok: true,
    ext: 'webm',
    kind: 'video',
  });
});

test('תמונה על הגבול (8MB בדיוק) מתקבלת; מעל הגבול נדחית עם 413 בעברית', () => {
  const boundary = validateMediaFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES });
  assert.equal(boundary.ok, true);

  const over = validateMediaFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 });
  assert.equal(over.ok, false);
  if (!over.ok) {
    assert.equal(over.status, 413);
    assert.equal(typeof over.error, 'string');
    assert.ok(over.error.includes('8MB'));
    assert.ok(/[\u0590-\u05FF]/.test(over.error));
  }
});

test('סרטון על הגבול (30MB בדיוק) מתקבל; מעל הגבול נדחה עם 413 בעברית', () => {
  const boundary = validateMediaFile({ type: 'video/mp4', size: MAX_VIDEO_BYTES });
  assert.equal(boundary.ok, true);

  const over = validateMediaFile({ type: 'video/webm', size: MAX_VIDEO_BYTES + 1 });
  assert.equal(over.ok, false);
  if (!over.ok) {
    assert.equal(over.status, 413);
    assert.equal(typeof over.error, 'string');
    assert.ok(over.error.includes('30MB'));
    assert.ok(/[\u0590-\u05FF]/.test(over.error));
  }
});

test('סוג לא נתמך נדחה עם 415 והודעה בעברית', () => {
  const r = validateMediaFile({ type: 'application/pdf', size: 1024 });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 415);
    assert.equal(typeof r.error, 'string');
    assert.ok(/[\u0590-\u05FF]/.test(r.error));
  }
});

test('גם תמונה גדולה מדי שהיא סוג לא נתמך נדחית קודם על הסוג (415)', () => {
  const r = validateMediaFile({ type: 'image/gif', size: MAX_IMAGE_BYTES + 1 });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 415);
  }
});
