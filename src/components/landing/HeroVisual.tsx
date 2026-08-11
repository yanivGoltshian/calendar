'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { Float } from '@/components/motion';
import { ArrowNextIcon } from '@/components/landing/icons';
import { t } from '@/i18n';

/**
 * HeroVisual — סצנה אנושית ומזמינה: מאיה (בעלת עסק) עומדת לצד כרטיס יומן
 * מונפש עם שעות פנויות ושבב אישור צף. מכבד prefers-reduced-motion,
 * ושומרת על עמוד נקי גם במובייל.
 */
const slots = [
  { time: '09:00', taken: false },
  { time: '10:30', taken: true },
  { time: '12:00', taken: false },
  { time: '13:30', taken: false },
  { time: '16:00', taken: true },
  { time: '17:30', taken: false },
];

export function HeroVisual() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-md pb-4 sm:pe-16 lg:pe-20">
      {/* הילת רקע */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[3rem] bg-brand-sheen opacity-20 blur-3xl"
      />

      <Float amplitude={reduce ? 0 : 12} duration={7}>
        <div className="rounded-4xl border border-white/60 bg-white/80 p-5 shadow-elevated backdrop-blur-sm dark:border-sand-700/60 dark:bg-sand-800/80">
          {/* כותרת הכרטיס */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/brand/torchick-emblem-mark.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <div>
                <div className="text-sm font-bold text-sand-900 dark:text-sand-50">
                  בחירת מועד
                </div>
                <div className="text-xs text-sand-500">יום שלישי, 14 במאי</div>
              </div>
            </div>
            <span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-950/50 dark:text-accent-200">
              פנוי
            </span>
          </div>

          {/* רשת שעות */}
          <div className="grid grid-cols-3 gap-2.5">
            {slots.map((slot, i) => (
              <motion.div
                key={slot.time}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                className={
                  slot.taken
                    ? 'rounded-xl border border-sand-200 bg-sand-100 py-2.5 text-center text-sm font-medium text-sand-400 line-through dark:border-sand-700 dark:bg-sand-900/60'
                    : 'rounded-xl border border-brand-200 bg-brand-50 py-2.5 text-center text-sm font-semibold text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200'
                }
              >
                {slot.time}
              </motion.div>
            ))}
          </div>

          {/* פס פעולה */}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-gradient px-4 py-3 text-white">
            <span className="text-sm font-semibold">אישור התור</span>
            <ArrowNextIcon aria-hidden className="h-5 w-5" />
          </div>
        </div>
      </Float>

      {/* שבב אישור צף */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, x: -8 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.5, delay: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute -bottom-5 start-0 flex items-center gap-2 rounded-2xl border border-sand-200/70 bg-white/95 px-3.5 py-2.5 shadow-elevated dark:border-sand-700/70 dark:bg-sand-800/95"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300">
          ✓
        </span>
        <div className="text-start">
          <div className="text-xs font-bold text-sand-900 dark:text-sand-50">התור נקבע</div>
          <div className="text-[11px] text-sand-500">תזכורת תישלח אוטומטית</div>
        </div>
      </motion.div>

      {/* מאיה — בעלת עסק, עומדת לצד הכרטיס */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="pointer-events-none absolute -bottom-4 -end-3 z-10 w-24 sm:-end-2 sm:w-28 lg:w-32"
      >
        <Image
          src="/brand/mascots/maya-full.png"
          alt={t.marketing.mascots.heroAlt}
          width={358}
          height={1240}
          priority
          className="h-auto w-full drop-shadow-xl"
        />
      </motion.div>
    </div>
  );
}

export default HeroVisual;
