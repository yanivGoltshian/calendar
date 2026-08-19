import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approxDataUrlBytes, encodeUnderLimit } from './imageEncode';

test('approxDataUrlBytes: מחשב גודל מטען base64 בלי הקידומת', () => {
  // "AAAA" = 4 תווי base64 = 3 בייטים
  assert.equal(approxDataUrlBytes('data:image/png;base64,AAAA'), 3);
});

test('approxDataUrlBytes: מפחית ריפוד =', () => {
  assert.equal(approxDataUrlBytes('data:image/png;base64,AAA='), 2);
  assert.equal(approxDataUrlBytes('data:image/png;base64,AA=='), 1);
});

test('approxDataUrlBytes: מטען ריק ⇐ 0', () => {
  assert.equal(approxDataUrlBytes('data:image/png;base64,'), 0);
});

test('encodeUnderLimit: PNG מקודד פעם אחת ומוחזר כמות שהוא', () => {
  let calls = 0;
  const res = encodeUnderLimit({
    encode: () => {
      calls += 1;
      return 'data:image/png;base64,AAAA';
    },
    compressible: false,
    maxBytes: 10,
  });
  assert.equal(calls, 1);
  assert.equal(res.ok, true);
  assert.equal(res.dataUrl, 'data:image/png;base64,AAAA');
});

test('encodeUnderLimit: JPEG יורד במדרגות איכות עד שנכנס בתקרה', () => {
  const byQuality: Record<string, string> = {
    '0.85': 'data:image/jpeg;base64,' + 'A'.repeat(200), // ~150 בייט
    '0.7': 'data:image/jpeg;base64,' + 'A'.repeat(120), // ~90 בייט
    '0.6': 'data:image/jpeg;base64,' + 'A'.repeat(40), // ~30 בייט
    '0.5': 'data:image/jpeg;base64,' + 'A'.repeat(20), // ~15 בייט
  };
  const seen: number[] = [];
  const res = encodeUnderLimit({
    encode: (q) => {
      seen.push(q ?? -1);
      return byQuality[String(q ?? 0.85)];
    },
    compressible: true,
    maxBytes: 40,
    qualitySteps: [0.7, 0.6, 0.5],
  });
  assert.equal(res.ok, true);
  // ניסה 0.85 (גדול), 0.7 (גדול), 0.6 (נכנס ⇐ עצר)
  assert.deepEqual(seen, [0.85, 0.7, 0.6]);
});

test('encodeUnderLimit: נשאר גדול מדי בכל המדרגות ⇐ ok=false', () => {
  const res = encodeUnderLimit({
    encode: () => 'data:image/jpeg;base64,' + 'A'.repeat(400),
    compressible: true,
    maxBytes: 10,
    qualitySteps: [0.7, 0.6, 0.5],
  });
  assert.equal(res.ok, false);
});
