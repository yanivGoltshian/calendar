import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECTORY_MIN_LISTED,
  shouldShowDirectoryLink,
  isPubliclyListed,
  filterPubliclyListed,
} from './directory';

test('הסף המאוחד הוא 3', () => {
  assert.equal(DIRECTORY_MIN_LISTED, 3);
});

test('שער הקישור: 3 ומעלה מציג, מתחת ל-3 מסתיר', () => {
  assert.equal(shouldShowDirectoryLink(0), false);
  assert.equal(shouldShowDirectoryLink(1), false);
  assert.equal(shouldShowDirectoryLink(2), false);
  assert.equal(shouldShowDirectoryLink(3), true);
  assert.equal(shouldShowDirectoryLink(10), true);
});

test('שער הקישור נכשל-סגור על קלט לא-תקין', () => {
  assert.equal(shouldShowDirectoryLink(Number.NaN), false);
  assert.equal(shouldShowDirectoryLink(-5), false);
  // אינסוף אינו ספירה תקינה — נכשל-סגור ומסתיר, למרות ש-∞ ≥ 3.
  assert.equal(shouldShowDirectoryLink(Number.POSITIVE_INFINITY), false);
});

test('פרדיקט מוצג-לציבור דורש listed=true ולא ממתין למחיקה', () => {
  assert.equal(isPubliclyListed({ listed: true, accountStatus: 'ACTIVE' }), true);
  assert.equal(isPubliclyListed({ listed: true }), true);
  assert.equal(isPubliclyListed({ listed: false, accountStatus: 'ACTIVE' }), false);
  assert.equal(isPubliclyListed({ listed: true, accountStatus: 'PENDING_DELETION' }), false);
  assert.equal(isPubliclyListed({ accountStatus: 'ACTIVE' }), false);
});

test('סינון רשימה מחזיר רק עסקים מוצגים', () => {
  const rows = [
    { slug: 'a', listed: true, accountStatus: 'ACTIVE' },
    { slug: 'b', listed: false, accountStatus: 'ACTIVE' },
    { slug: 'c', listed: true, accountStatus: 'PENDING_DELETION' },
    { slug: 'd', listed: true, accountStatus: 'ACTIVE' },
  ];
  assert.deepEqual(
    filterPubliclyListed(rows).map((r) => r.slug),
    ['a', 'd'],
  );
});
