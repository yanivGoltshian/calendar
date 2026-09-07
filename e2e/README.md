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

The reporter requires at least **10 collected cases**, all passing and none
skipped. Missing server, seed, database or explicit booking opt-in fails visibly.
The gate supplies these values itself:

| Variable | Meaning |
| --- | --- |
| `E2E_BASE_URL` | Isolated loopback server |
| `E2E_BUSINESS_SLUG` | Eligible synthetic seeded business |
| `E2E_ALLOW_BOOKING=1` | Explicit synthetic write permission |
| `TEST_DATABASE_URL` | Disposable database used by fixtures and actual repositories |
| `E2E_MIN_TESTS=10` | Required collected/passed minimum |

Coverage includes customer/owner login, public business pages, contact feedback,
guest booking with a lost response and cancelled idempotent replay, concurrent
booking, verified cancellation, continuous onboarding through publication,
legacy media/structured data and timezone/midnight hydration.

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

CI has no skip-by-default or `continue-on-error` browser path. The reusable gate
also runs before the manually requested image build. Production mutation still
requires separate explicit authorization.
