# Isolated release and browser regression

Run the maintained gate with Node 22, installed PostgreSQL binaries and Chromium:

```sh
npm run test:release
```

The runner creates fresh local databases, proves clean migration replay and a
failed-overlap upgrade/recovery with historical checksums/data preserved, seeds
eligible synthetic businesses, then runs typecheck, lint, units, production build,
real database/HTTP integration and all browser checks. It starts the standalone
Next runtime, copies its public/static assets and stops its own processes in `finally`.
It rejects local `.env` files and passes only whitelisted synthetic configuration.
Never use production credentials, databases, recipients or storage.

`TEST_PG_BIN` can select the PostgreSQL binary directory. Local defaults are
PostgreSQL14 on port55449 and the app on port3149; CI installs PostgreSQL16.
Use Node22 and npm10.9.8 locally to match CI, rather than the machine's default
Node25/npm11. Switching only the Node binary does not switch npm. Maintain the
lock with the CI npm version so optional cross-platform dependencies remain present.

## Required browser scope

The reporter requires at least **29 collected cases**, all passing and none
skipped. Missing server, seed, database or explicit booking opt-in fails visibly.
The gate supplies these values itself:

| Variable | Meaning |
| --- | --- |
| `E2E_BASE_URL` | Isolated loopback server |
| `E2E_BUSINESS_SLUG` | Eligible synthetic seeded business |
| `E2E_ALLOW_BOOKING=1` | Explicit synthetic write permission |
| `TEST_DATABASE_URL` | Disposable database used by fixtures and actual repositories |
| `E2E_EXPECT_MINIMUM=29` | Required collected/passed minimum |

Coverage includes customer/owner login, public business pages, contact feedback,
guest booking with a lost response and cancelled idempotent replay, concurrent
booking, verified cancellation, continuous onboarding through publication,
legacy media/structured data and timezone/midnight hydration.
The expanded matrix also covers decorative video decoding/crop/actual time
advancement at 360/390/768/1366px, reduced motion, save-data, rejected autoplay,
missing media, controlled YouTube/Vimeo frames, image crop cancellation and
upload retry, editor playback, published playback, waitlist retry and PWA icons.
Email/SMS delivery and cloud uploads use explicit browser stubs; OTP verification,
owner publication, customer sessions, bookings, cancellation and waitlist writes
use the actual local application and disposable database. External provider
playback and physical-device installation require separate acceptance.

The media case takes three cold mobile measurements each for home, clinic and a
large legacy fixture:390×844,200000bytes/s,150ms latency,4×CPU slowdown.
It records individual LCP values/medians and real navigation/image budgets.
These local synthetic measurements are separate from live or field performance.
All external browser traffic is blocked in that measurement.

## Evidence and diagnostics

`.test-runtime/run-*/` contains app/database logs, separate unit/integration
source-line reach reports and `success.json`. `fullReleaseGate:true` means no
diagnostic skip/reuse flag was used. Playwright retains traces on failure and
attaches media budgets/mobile measurements. CI uploads all these artifacts.

Unit coverage inventories every production runtime source file, including
unloaded files at zero, using V8 ranges and source maps. Integration coverage
measures directly imported source modules. Compiled Next HTTP/browser execution
has behavioral assertions and is not added to either line-reach percentage.
Do not combine these scopes or present them as branch/statement coverage.

`--skip-static`, `--development`, `--reuse-build` and `--migrations-only` are
diagnostic modes; none is acceptable final release evidence. Reusing a build
against a freshly seeded database can retain obsolete static staff/service IDs.
Always rebuild for the complete gate.

To run a bounded browser selection during development:

```sh
TEST_APP_PORT=3157 TEST_DB_PORT=55457 npm run test:release -- --skip-static --development '--e2e=hero-regression|public-matrix'
```

The runner alone enables `E2E_TARGETED=1` for an explicit selection. This lowers
the collection floor to one while still rejecting skipped/failed cases and
marks `fullReleaseGate:false`.

## Exact-source visual comparison

```sh
TEST_APP_PORT=3157 TEST_DB_PORT=55457 npm run test:release -- --skip-static --compare-public
```

This seeds one synthetic dataset, builds the working tree, then builds exact
pre-audit `0ea8d5d8240daa024e89f4b4df415499f32b7799` and deployed
`0db8ad6a73ef394381f49621e69570544a198e2c` source archives in disposable directories.
All three use the current locked dependencies, Node runtime, database schema,
browser and media, so this isolates source/UX changes rather than reconstructing
historical dependency vulnerabilities. No checkout or production data is changed.
Each archived source generates a private Prisma client from its own schema;
the candidate's generated client is never replaced by a historical schema.
The generated test-pattern video is temporarily copied into `public/images/visual-regression`
and removed when the runner exits.

The comparison records full pages and hero crops at all four widths, fixed media
time and browser clock, bounding boxes, playback state and three cold throttled
mobile measurements per source. Controlled embed responses are labelled explicitly.
Artifacts live under `.test-runtime/run-*/comparison/`. Inspect the screenshots;
geometry assertions and HTTP success alone do not establish visual fidelity.
Comparison mode is diagnostic and always marks `fullReleaseGate:false`.

CI has no skip-by-default or `continue-on-error` browser path. The reusable gate
also runs before the manually requested image build. Production mutation still
requires separate explicit authorization.
