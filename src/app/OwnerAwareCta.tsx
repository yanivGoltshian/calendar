'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  guestHref: string;
  guestLabel: string;
  ownerHref: string;
  ownerLabel: string;
  variant?: Variant;
  size?: Size;
  className?: string;
};

/**
 * כפתור CTA מודע-בעלים לדף הבית הסטטי. שלד ה-HTML נבנה בזמן build עם וריאנט
 * האורח בלבד, ולכן אינו מכיל מידע אישי ונשמר במטמון זהה לכל המבקרים. לאחר
 * העלייה נשלף המסלול /api/public/owner-status (בוליאני בלבד, ללא PII); אם המבקר
 * הוא בעל עסק חוזר, הכפתור מתחלף לתווית וה-href של הבעלים ושומר על ה-UX הקודם
 * (החלפת CTA), ללא הפניה אוטומטית.
 */
export function OwnerAwareCta({
  guestHref,
  guestLabel,
  ownerHref,
  ownerLabel,
  variant,
  size,
  className,
}: Props) {
  const [isReturningOwner, setIsReturningOwner] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/public/owner-status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.isReturningOwner) {
          setIsReturningOwner(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <Button
      href={isReturningOwner ? ownerHref : guestHref}
      variant={variant}
      size={size}
      className={className}
    >
      {isReturningOwner ? ownerLabel : guestLabel}
    </Button>
  );
}
