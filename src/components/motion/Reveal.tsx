'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  /** כיוון הכניסה */
  direction?: 'up' | 'down' | 'right' | 'left';
  /** עיכוב בשניות */
  delay?: number;
  /** מרחק ההיסט ההתחלתי בפיקסלים */
  distance?: number;
  className?: string;
  /** האם להריץ פעם אחת בלבד */
  once?: boolean;
};

/**
 * Reveal — חשיפה בגלילה: מופיע בעדינות עם היסט קל.
 * מכבד prefers-reduced-motion (ללא תזוזה כשמופעל).
 */
export function Reveal({
  children,
  direction = 'up',
  delay = 0,
  distance = 24,
  className,
  once = true,
}: RevealProps) {
  const reduce = useReducedMotion();

  const offset = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    right: { x: -distance, y: 0 },
    left: { x: distance, y: 0 },
  }[direction];

  const variants: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 0.6,
        delay,
        ease: [0.2, 0.8, 0.2, 1],
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '0px 0px -80px 0px' }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
