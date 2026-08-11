'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type StaggerProps = {
  children: ReactNode;
  className?: string;
  /** מרווח בין פריטים בשניות */
  gap?: number;
  /** עיכוב לפני תחילת הרצף */
  delay?: number;
  once?: boolean;
};

/**
 * Stagger — מיכל שמנפיש את ילדיו ברצף (staggerChildren).
 * יש לעטוף כל פריט ב-<StaggerItem>.
 */
export function Stagger({
  children,
  className,
  gap = 0.1,
  delay = 0,
  once = true,
}: StaggerProps) {
  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: gap,
        delayChildren: delay,
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '0px 0px -60px 0px' }}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  distance?: number;
};

/** StaggerItem — פריט בודד בתוך <Stagger>. מכבד תנועה מופחתת. */
export function StaggerItem({ children, className, distance = 20 }: StaggerItemProps) {
  const reduce = useReducedMotion();

  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] },
    },
  };

  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}

export default Stagger;
