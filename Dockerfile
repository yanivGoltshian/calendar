# syntax=docker/dockerfile:1

# ============================================================================
# Dockerfile רב-שלבי ל-Next.js 15 במצב standalone.
# ----------------------------------------------------------------------------
# הערת אינטגרציה חשובה (לביצוע בשלב האינטגרציה, לא כאן):
#   קובץ next.config.mjs חייב לכלול  output: 'standalone'  כדי ששלב ה-runner
#   יעבוד. ראו docs/deployment-cost.md → "שינוי קונפיג נדרש". ללא שינוי זה
#   התיקייה .next/standalone לא תיווצר וה-build של האימג' ייכשל.
#
# הערה נוספת: NEXT_PUBLIC_APP_URL מוטמע בזמן build ע"י Next.js, לכן הוא מוזרק
#   כ-ARG בשלב ה-builder ולא רק כמשתנה סביבה בזמן ריצה.
# ============================================================================

# ---------- שלב 1: התקנת תלויות ----------
FROM node:20-alpine AS deps
# libc6-compat נדרש עבור מנועי Prisma על alpine (musl)
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---------- שלב 2: בנייה ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# כתובת ציבורית מוטמעת בזמן build (ערך client-side)
ARG NEXT_PUBLIC_APP_URL=https://torchick.com
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# תצורת Firebase (client-side, אופציונלית) — חייבת להיות מוטמעת בזמן build כי
# Next.js מטמיע משתני NEXT_PUBLIC_* לתוך ה-bundle. ריק כברירת מחדל → firebaseEnabled
# הוא false וה-UI מסתיר את מסלול הטלפון-דרך-Firebase (אפס שינוי לבנייה קיימת).
ARG NEXT_PUBLIC_FIREBASE_API_KEY=
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=
ARG NEXT_PUBLIC_FIREBASE_APP_ID=
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}

ENV NEXT_TELEMETRY_DISABLED=1
# build script מריץ prisma generate ואז next build
RUN npm run build

# ---------- שלב 3: ריצה (runner) ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# משתמש לא-root מטעמי אבטחה
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# פלט standalone כולל שרת מינימלי ואת התלויות הנדרשות בלבד
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# סכימת Prisma ומנועים נדרשים בזמן ריצה
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# server.js נוצר ע"י פלט ה-standalone של Next.js
CMD ["node", "server.js"]
