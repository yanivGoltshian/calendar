import type { Config } from 'tailwindcss';

/**
 * מערכת עיצוב — טוקנים מרוכזים.
 *
 * בסיס ניטרלי חמים (sand), אקסנט סגול מעודן (brand) ואקסנט זהב חם (accent),
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
        // אקסנט ראשי — סגול מעודן ועשיר
        brand: {
          50: '#f5f2ff',
          100: '#ece6ff',
          200: '#dccfff',
          300: '#c3aaff',
          400: '#a67cfa',
          500: '#8b53f0',
          600: '#7a37e0',
          700: '#6826bd',
          800: '#57219a',
          900: '#481d7c',
          950: '#2d0f54',
        },
        // אקסנט משני — זהב חם להדגשות עדינות
        accent: {
          50: '#fdf9ed',
          100: '#faf0cf',
          200: '#f4df9c',
          300: '#edc75f',
          400: '#e7b23a',
          500: '#d99a26',
          600: '#c07a1d',
          700: '#9f5b1b',
          800: '#82481d',
          900: '#6c3c1b',
          950: '#3e1e0b',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Assistant', 'Heebo', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Frank Ruhl Libre', 'Georgia', 'serif'],
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
        glow: '0 10px 40px -10px rgb(122 55 224 / 0.45)',
        'glow-soft': '0 8px 30px -12px rgb(122 55 224 / 0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7a37e0 0%, #a67cfa 100%)',
        'brand-sheen': 'linear-gradient(135deg, #6826bd 0%, #8b53f0 55%, #d99a26 130%)',
        'sand-fade': 'linear-gradient(180deg, #faf8f5 0%, #f4efe9 100%)',
        'radial-glow':
          'radial-gradient(60% 60% at 50% 0%, rgb(139 83 240 / 0.14) 0%, transparent 70%)',
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
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
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
