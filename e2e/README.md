# E2E tests (Playwright)

End-to-end specs for תור צ׳יק / Torchick, covering the public and critical user
flows. The suite is **green by default**: with no server running, every spec
skips itself instead of failing, so `npm run test:e2e` is safe to run anywhere.

## What's here

| Spec | Flow | Needs |
| --- | --- | --- |
| `customer-login.spec.ts` | Customer email OTP request UI (`/login`) | server |
| `owner-login.spec.ts` | Owner sign-in screen (`/business/login`) | server |
| `public-business.spec.ts` | Public business page + booking CTA (`/b/[slug]`) | server + slug |
| `booking-stepper.spec.ts` | Booking stepper navigation/validation | server + slug |
| `booking-happy-path.spec.ts` | Full 6-step guest booking → confirmed appointment | server + slug + opt-in |

Gating is controlled entirely by environment variables — no code changes
required to widen or narrow what runs.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3000` | Base URL the specs hit. Specs skip when it's unreachable. |
| `E2E_BUSINESS_SLUG` | _(empty)_ | Slug of a seeded business. Unlocks the DB-backed booking specs. |
| `E2E_ALLOW_BOOKING` | _(empty)_ | Set to `1` to allow the happy-path spec to **write** a real appointment. |

## Running

### 1. Green-by-default (no server)

```bash
npm run test:e2e
```

Every spec skips itself — this is what CI runs. Requires the chromium browser
binary once:

```bash
npx playwright install chromium
```

### 2. Against a local `next start` + a disposable Postgres

```bash
# a) disposable Postgres (Docker)
docker run --rm -d --name torchick-e2e -p 5433:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=torchick postgres:16
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/torchick?schema=public"

# b) migrate + (optionally) seed a business, service, staff and working hours
npx prisma migrate deploy

# c) build & start the app
npm run build
npm start &            # serves on http://localhost:3000

# d) point the specs at it
export E2E_BASE_URL="http://localhost:3000"
export E2E_BUSINESS_SLUG="<your-seeded-slug>"   # unlocks booking specs
# export E2E_ALLOW_BOOKING=1                     # only to write a real booking
npm run test:e2e
```

The happy-path spec books as a **guest** (no OTP round-trip). It scans forward
day-by-day for the first date with availability, so the seeded business needs a
service, a bookable staff member, and working hours. Thanks to the availability
business-hours fallback, BUSINESS-scope hours are enough even if the staff
member has no staff-scope hours.

> **OTP note:** the login specs stop at the "send code" step and do not verify a
> code, so they need no mailbox. In dev, one-time codes are printed to the
> **server console** (`emailDevHint`), which is the fallback to use if you extend
> these specs to a full sign-in.

### 3. Against a deployed environment

```bash
export E2E_BASE_URL="https://<your-deployment>"
export E2E_BUSINESS_SLUG="<slug>"
npm run test:e2e
```

Leave `E2E_ALLOW_BOOKING` unset against any environment where you don't want a
real appointment created.

## Notes

- Playwright's loader doesn't resolve the app's `@/…` TS path aliases, so the
  Hebrew UI strings the specs match on are duplicated in `e2e/strings.ts`. If a
  label changes in `src/i18n/he.ts`, update the matching constant there.
- There is intentionally no `webServer` block in `playwright.config.ts` — the
  suite never boots the app for you, keeping it DB-free and green by default.
