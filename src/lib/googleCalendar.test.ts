import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleCalendarUrl } from './googleCalendar';

test('buildGoogleCalendarUrl formats UTC dates and encodes params', () => {
  const url = buildGoogleCalendarUrl({
    title: 'טיפול פנים',
    start: new Date('2026-09-02T09:30:00.000Z'),
    end: new Date('2026-09-02T10:15:00.000Z'),
    details: 'עם דנה',
    location: 'יבנה',
  });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(u.searchParams.get('action'), 'TEMPLATE');
  assert.equal(u.searchParams.get('dates'), '20260902T093000Z/20260902T101500Z');
  assert.equal(u.searchParams.get('text'), 'טיפול פנים');
  assert.equal(u.searchParams.get('details'), 'עם דנה');
  assert.equal(u.searchParams.get('location'), 'יבנה');
});

test('buildGoogleCalendarUrl omits optional fields when absent', () => {
  const url = buildGoogleCalendarUrl({
    title: 'x',
    start: new Date('2026-01-01T00:00:00.000Z'),
    end: new Date('2026-01-01T00:30:00.000Z'),
  });
  const u = new URL(url);
  assert.equal(u.searchParams.get('details'), null);
  assert.equal(u.searchParams.get('location'), null);
});
