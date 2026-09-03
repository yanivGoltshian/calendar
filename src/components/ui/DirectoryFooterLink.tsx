'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';

/**
 * קישור הכותרת התחתונה לספריית העסקים (/businesses), מגודר בשער ≥3.
 * הכותרת התחתונה מרונדרת בשלד סטטי שאינו סופר עסקים בזמן רינדור, לכן רכיב לקוח
 * קטן זה שולף את מצב השער אחרי הטעינה ומציג את הקישור רק כשמספר העסקים המוצגים ≥ 3.
 * בטוח מפני כשל: כל כשל משאיר את הקישור מוסתר (fail-closed).
 */
export function DirectoryFooterLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/public/directory-status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.visible === true) setVisible(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <li>
      <Link href="/businesses" className="transition-colors hover:text-brand-700 dark:hover:text-brand-200">
        {t.marketing.nav.businesses}
      </Link>
    </li>
  );
}

export default DirectoryFooterLink;
