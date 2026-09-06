'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function DirectoryLink() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/public/directory-status', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setVisible(data?.visible === true)).catch(() => {});
    return () => controller.abort();
  }, []);
  return visible ? <Link href="/businesses" className="rounded-full px-3 py-2 text-sm hover:text-brand-700">עסקים לקביעת תור</Link> : null;
}
