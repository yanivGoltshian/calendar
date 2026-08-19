import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, maxCropSize, computeCropRect, outputSize } from './imageCrop';

test('clamp: מגביל לטווח', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(42, 0, 10), 10);
});

test('maxCropSize: מקור רחב מהיעד ⇐ הגובה מגביל', () => {
  // 1000x500 (2:1), יעד ריבוע ⇐ 500x500
  assert.deepEqual(maxCropSize(1000, 500, 1), { width: 500, height: 500 });
});

test('maxCropSize: מקור צר מהיעד ⇐ הרוחב מגביל', () => {
  // 400x800 (1:2), יעד ריבוע ⇐ 400x400
  assert.deepEqual(maxCropSize(400, 800, 1), { width: 400, height: 400 });
});

test('maxCropSize: מימדים לא תקינים ⇐ אפסים', () => {
  assert.deepEqual(maxCropSize(0, 500, 1), { width: 0, height: 0 });
  assert.deepEqual(maxCropSize(500, 500, 0), { width: 0, height: 0 });
});

test('computeCropRect: ברירת מחדל ממורכזת (zoom=1)', () => {
  // ריבוע מתוך 1000x500 ⇐ 500x500, ממורכז אופקית
  const r = computeCropRect({
    naturalWidth: 1000,
    naturalHeight: 500,
    targetAspect: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  assert.deepEqual(r, { sx: 250, sy: 0, sWidth: 500, sHeight: 500 });
});

test('computeCropRect: הזזה קיצונית נשארת בגבולות', () => {
  const base = {
    naturalWidth: 1000,
    naturalHeight: 500,
    targetAspect: 1,
    zoom: 1,
    offsetY: 0,
  };
  assert.deepEqual(
    computeCropRect({ ...base, offsetX: -1 }),
    { sx: 0, sy: 0, sWidth: 500, sHeight: 500 },
  );
  assert.deepEqual(
    computeCropRect({ ...base, offsetX: 1 }),
    { sx: 500, sy: 0, sWidth: 500, sHeight: 500 },
  );
  // מעבר לטווח נחסם ל-[-1,1]
  assert.deepEqual(
    computeCropRect({ ...base, offsetX: 5 }),
    { sx: 500, sy: 0, sWidth: 500, sHeight: 500 },
  );
});

test('computeCropRect: זום מקטין את מלבן המקור וממרכז מחדש', () => {
  const r = computeCropRect({
    naturalWidth: 1000,
    naturalHeight: 500,
    targetAspect: 1,
    zoom: 2,
    offsetX: 0,
    offsetY: 0,
  });
  // 500/2 = 250; free = (750, 250); ממורכז ⇐ (375, 125)
  assert.deepEqual(r, { sx: 375, sy: 125, sWidth: 250, sHeight: 250 });
});

test('computeCropRect: zoom<1 מטופל כ-1', () => {
  const r = computeCropRect({
    naturalWidth: 600,
    naturalHeight: 600,
    targetAspect: 1,
    zoom: 0.3,
    offsetX: 0,
    offsetY: 0,
  });
  assert.deepEqual(r, { sx: 0, sy: 0, sWidth: 600, sHeight: 600 });
});

test('outputSize: ריבוע לוגו חסום ל-512', () => {
  assert.deepEqual(
    outputSize({ targetAspect: 1, maxWidth: 512, maxHeight: 512 }),
    { width: 512, height: 512 },
  );
});

test('outputSize: באנר 16:9 חסום ל-1280x720', () => {
  assert.deepEqual(
    outputSize({ targetAspect: 16 / 9, maxWidth: 1280, maxHeight: 720 }),
    { width: 1280, height: 720 },
  );
});

test('outputSize: הגובה מגביל כשהיחס צר', () => {
  // יחס 1 עם רוחב מרבי גדול מגובה מרבי ⇐ הגובה קובע
  assert.deepEqual(
    outputSize({ targetAspect: 1, maxWidth: 1000, maxHeight: 400 }),
    { width: 400, height: 400 },
  );
});
