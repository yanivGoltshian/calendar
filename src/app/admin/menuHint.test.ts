import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MENU_HINT_STORAGE_KEY,
  shouldShowMenuHint,
  markMenuHintSeen,
} from './menuHint';

/** אחסון מזויף פשוט בזיכרון שמחקה את החלק הרלוונטי מ-Storage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

test('shouldShowMenuHint: מציג כאשר המפתח אינו קיים באחסון', () => {
  const storage = fakeStorage();
  assert.equal(shouldShowMenuHint(storage), true);
});

test('shouldShowMenuHint: לא מציג כאשר המפתח כבר קיים באחסון', () => {
  const storage = fakeStorage({ [MENU_HINT_STORAGE_KEY]: '1' });
  assert.equal(shouldShowMenuHint(storage), false);
});

test('shouldShowMenuHint: לא מציג כאשר אין אחסון כלל (null/undefined)', () => {
  assert.equal(shouldShowMenuHint(null), false);
  assert.equal(shouldShowMenuHint(undefined), false);
});

test('markMenuHintSeen ואז shouldShowMenuHint מחזיר false', () => {
  const storage = fakeStorage();
  assert.equal(shouldShowMenuHint(storage), true);
  markMenuHintSeen(storage);
  assert.equal(shouldShowMenuHint(storage), false);
  assert.equal(storage.getItem(MENU_HINT_STORAGE_KEY), '1');
});

test('shouldShowMenuHint: מתגונן בפני חריגה מ-getItem', () => {
  const throwing = {
    getItem: () => {
      throw new Error('access denied');
    },
  };
  assert.equal(shouldShowMenuHint(throwing), false);
});
