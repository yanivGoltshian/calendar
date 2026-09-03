import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// esbuild/tsx מקמפל את ה-JSX ל-React.createElement קלאסי, והרכיבים אינם מייבאים
// את React (ריצת ה-runtime האוטומטי של Next). לכן חושפים את React גלובלית לפני
// הרינדור, כדי שאפשר יהיה לרנדר את רכיב הלקוח ישירות בבדיקה.
(globalThis as unknown as { React: typeof React }).React = React;

import { OwnerAwareCta } from './OwnerAwareCta';

// שלד ה-HTML הסטטי של דף הבית חייב להיבנות עם וריאנט האורח בלבד (ללא PII של
// בעלים). ה-useEffect (שליפת /api/public/owner-status והחלפת ה-CTA) אינו רץ
// ברינדור לשרת, ולכן renderToStaticMarkup משקף בדיוק את ה-HTML שנשמר במטמון.

const GUEST_HREF = '/business/new';
const GUEST_LABEL = 'הרשמה';
// ערכי סנטינל שמדמים מידע אישי של בעלים חוזר; אסור שיופיעו ב-HTML הסטטי.
const OWNER_HREF = '/admin-owner-only-secret';
const OWNER_LABEL = 'owner-pii-sentinel-שם-פרטי';

function renderCta(): string {
  return renderToStaticMarkup(
    React.createElement(OwnerAwareCta, {
      guestHref: GUEST_HREF,
      guestLabel: GUEST_LABEL,
      ownerHref: OWNER_HREF,
      ownerLabel: OWNER_LABEL,
    }),
  );
}

test('OwnerAwareCta: השלד הסטטי מכיל את וריאנט האורח (תווית + href)', () => {
  const html = renderCta();
  assert.ok(html.includes(GUEST_LABEL), 'ציפינו לתווית האורח ב-HTML הסטטי');
  assert.ok(html.includes(`href="${GUEST_HREF}"`), 'ציפינו ל-href של האורח ב-HTML הסטטי');
});

test('OwnerAwareCta: השלד הסטטי אינו מכיל מידע של בעלים חוזר (אין דליפת PII)', () => {
  const html = renderCta();
  assert.ok(
    !html.includes(OWNER_LABEL),
    'תווית הבעלים (סנטינל PII) לא אמורה להופיע ב-HTML שנשמר במטמון',
  );
  assert.ok(
    !html.includes(OWNER_HREF),
    'ה-href של הבעלים לא אמור להופיע ב-HTML שנשמר במטמון',
  );
});
