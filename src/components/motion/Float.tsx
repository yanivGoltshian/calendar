'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type FloatProps = {
  children: ReactNode;
  className?: string;
  /** משרעת התנועה בפיקסלים */
  amplitude?: number;
  /** משך מחזור בשניות */
  duration?: number;
  /** עיכוב התחלתי */
  delay?: number;
};

/**
 * Float — ריחוף עדין ומתמשך למעלה ולמטה (למוקאפים ואלמנטים דקורטיביים).
 * כשמופעל prefers-reduced-motion — נשאר סטטי.
 */
export function Float({
  children,
  className,
  amplitude = 10,
  duration = 6,
  delay = 0,
}: FloatProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amplitude, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}

export default Float;
