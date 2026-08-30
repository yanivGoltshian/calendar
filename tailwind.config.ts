import type { Config } from 'tailwindcss';

/**
 * מערכת עיצוב — טוקנים מרוכזים.
 *
 * בסיס ניטרלי חמים (sand), אקסנט נייבי עמוק (brand) ואקסנט זהב חם (accent),
 * עם רדיוסים, צללים, גרדיאנטים וטיפוגרפיה כטוקנים. תמיכת מצב כהה דרך class.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1.25rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1200px',
      },
    },
    extend: {
      colors: {
        // בסיס ניטרלי חמים — משמש לרקעים, גבולות וטקסט
        sand: {
          50: '#faf8f5',
          100: '#f4efe9',
          200: '#e8dfd4',
          300: '#d6c8b8',
          400: '#b8a48d',
          500: '#9a8369',
          600: '#7c6650',
          700: '#5f4e3e',
          800: '#41362b',
          900: '#2a2119',
          950: '#1a140f',
        },
        // אקסנט ראשי — נייבי מלכותי עמוק
        brand: {
          50: '#eef3fa',
          100: '#d9e2f1',
          200: '#b7c8e2',
          300: '#8ba6cd',
          400: '#5c7fb0',
          500: '#35548a',
          600: '#24406e',
          700: '#16233a',
          800: '#0f1d33',
          900: '#0a182d',
          950: '#06101f',
        },
        // אקסנט משני — זהב חם להדגשות
        accent: {
          50: '#fbf6ea',
          100: '#f6ead0',
          200: '#f2d695',
          300: '#e4bf6f',
          400: '#d6ac54',
          500: '#cea24a',
          600: '#b5873a',
          700: '#9a7635',
          800: '#7c5f2e',
          900: '#674f28',
          950: '#3b2c13',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Assistant', 'Heebo', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Heebo', 'Assistant', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-sm': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'display-md': ['3.25rem', { lineHeight: '1.08', letterSpacing: '-0.015em' }],
        'display-lg': ['4.25rem', { lineHeight: '1.04', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgb(42 33 25 / 0.08), 0 4px 24px -6px rgb(42 33 25 / 0.08)',
        elevated: '0 8px 30px -6px rgb(42 33 25 / 0.12), 0 2px 8px -2px rgb(42 33 25 / 0.06)',
        glow: '0 10px 40px -10px rgb(206 162 74 / 0.40)',
        'glow-soft': '0 8px 30px -12px rgb(10 24 45 / 0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0a182d 0%, #24406e 100%)',
        'brand-sheen': 'linear-gradient(135deg, #06101f 0%, #16233a 55%, #cea24a 130%)',
        'sand-fade': 'linear-gradient(180deg, #faf8f5 0%, #f4efe9 100%)',
        'radial-glow':
          'radial-gradient(60% 60% at 50% 0%, rgb(36 64 110 / 0.16) 0%, transparent 70%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // סיבוב קוביית "מבצעים חמים" — עובר בין שש פאות הקובייה בלולאה חלקה.
        // מכובד prefers-reduced-motion דרך motion-reduce:animate-none ברכיב.
        'cube-spin': {
          '0%': { transform: 'rotateX(-14deg) rotateY(0deg)' },
          '16%': { transform: 'rotateX(-14deg) rotateY(-90deg)' },
          '33%': { transform: 'rotateX(-14deg) rotateY(-180deg)' },
          '50%': { transform: 'rotateX(-14deg) rotateY(-270deg)' },
          '66%': { transform: 'rotateX(-104deg) rotateY(-270deg)' },
          '83%': { transform: 'rotateX(76deg) rotateY(-270deg)' },
          '100%': { transform: 'rotateX(-14deg) rotateY(-360deg)' },
        },
        // דפדוף ספר — כרטיס שתי תמונות מתהפך על ציר Y, עם שהייה על כל פאה.
        'book-flip': {
          '0%, 42%': { transform: 'rotateY(0deg)' },
          '50%, 92%': { transform: 'rotateY(180deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        // סיבוב מנסרה משולשת — עצירה על כל אחת משלוש הפאות (0/−120/−240).
        'prism-spin': {
          '0%, 20%': { transform: 'rotateY(0deg)' },
          '33%, 53%': { transform: 'rotateY(-120deg)' },
          '66%, 86%': { transform: 'rotateY(-240deg)' },
          '100%': { transform: 'rotateY(-360deg)' },
        },
        // "נשימה" עדינה לתמונה יחידה — ריחוף והגדלה קלים על transform בלבד.
        'image-breathe': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-6px) scale(1.02)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
        'cube-spin': 'cube-spin 24s ease-in-out infinite',
        'book-flip': 'book-flip 9s ease-in-out infinite',
        'prism-spin': 'prism-spin 18s ease-in-out infinite',
        'image-breathe': 'image-breathe 6s ease-in-out infinite',
      },
      transitionTimingFunction: {
        emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
