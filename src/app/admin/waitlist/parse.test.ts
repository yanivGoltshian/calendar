import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWaitlistEnabled } from './parse';

/** בונה FormData מאובייקט פשוט. */
function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

test('parseWaitlistEnabled: on / true / 1 (וריאציות רישיות ורווחים) ⇐ true', () => {
  assert.equal(parseWaitlistEnabled(form({ enabled: 'on' })), true);
  assert.equal(parseWaitlistEnabled(form({ enabled: 'true' })), true);
  assert.equal(parseWaitlistEnabled(form({ enabled: '1' })), true);
  assert.equal(parseWaitlistEnabled(form({ enabled: '  ON  ' })), true);
  assert.equal(parseWaitlistEnabled(form({ enabled: 'True' })), true);
});

test('parseWaitlistEnabled: ריק / חסר / ערך אחר ⇐ false', () => {
  assert.equal(parseWaitlistEnabled(form({ enabled: '' })), false);
  assert.equal(parseWaitlistEnabled(form({})), false);
  assert.equal(parseWaitlistEnabled(form({ enabled: 'off' })), false);
  assert.equal(parseWaitlistEnabled(form({ enabled: '0' })), false);
  assert.equal(parseWaitlistEnabled(form({ enabled: 'false' })), false);
});

test('parseWaitlistEnabled: הלוך-ושוב true↔false נשמר נכון', () => {
  // מדליקים
  assert.equal(parseWaitlistEnabled(form({ enabled: 'on' })), true);
  // מכבים (הטוגל שולח ערך ריק כשמכבים)
  assert.equal(parseWaitlistEnabled(form({ enabled: '' })), false);
});
