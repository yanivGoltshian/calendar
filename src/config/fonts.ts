import { Heebo } from 'next/font/google';

/**
 * טיפוגרפיה עברית פרימיום — נטענת דרך next/font עם display: 'swap'.
 *
 * - כותרת (display): Heebo במשקלים כבדים — פונט תצוגה עברי נקי ומודרני.
 * - גוף (body): Heebo — פונט גוף עברי נקי וקריא.
 *
 * שניהם ממופים למשתני CSS ומחוברים ל-Tailwind (ראו tailwind.config.ts).
 */
export const fontBody = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-body',
});

export const fontDisplay = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['700', '800', '900'],
  display: 'swap',
  variable: '--font-display',
});

/** מחרוזת ה-className המשולבת להצמדה לתגית <html>. */
export const fontVariables = `${fontBody.variable} ${fontDisplay.variable}`;
