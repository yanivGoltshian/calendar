import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  openSync,
  closeSync,
  existsSync,
  writeFileSync,
  readFileSync,
  cpSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';

const root = process.cwd();
for (const path of [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.test.local',
]) {
  if (existsSync(path))
    throw new Error(`Isolated release tests refuse an existing ${path}`);
}
mkdirSync('.test-runtime', { recursive: true });
const runtime = mkdtempSync(resolve('.test-runtime/run-'));
const pgBin =
  process.env.TEST_PG_BIN ??
  (existsSync('/opt/homebrew/opt/postgresql@14/bin/initdb')
    ? '/opt/homebrew/opt/postgresql@14/bin'
    : '');
const pg = (name) => (pgBin ? join(pgBin, name) : name);
const port = Number(process.env.TEST_DB_PORT ?? 55449);
const appPort = Number(process.env.TEST_APP_PORT ?? 3149);
const browserSelection = process.argv.find((arg) => arg.startsWith('--e2e='))?.slice(6);
const comparePublic = process.argv.includes('--compare-public');
async function assertPortFree(value) {
  const server = createServer();
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(value, '127.0.0.1', resolve),
  );
  await new Promise((resolve) => server.close(resolve));
}
await assertPortFree(port);
await assertPortFree(appPort);
const database = `postgresql://postgres@127.0.0.1:${port}/torchick_test?schema=public`;
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR ?? '/tmp',
  CI: '1',
  LANG: 'en_US.UTF-8',
  TZ: 'UTC',
  NEXT_TELEMETRY_DISABLED: '1',
  DATABASE_URL: database,
  TEST_DATABASE_URL: database,
  SESSION_SECRET: 'synthetic-release-session-secret-at-least-32-characters',
  AUTH_SECRET: 'synthetic-release-auth-secret-at-least-32-characters',
  OTP_PEPPER: 'synthetic-release-otp-pepper',
  AUTH_TRUST_HOST: 'true',
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${appPort}`,
  AUTH_URL: `http://127.0.0.1:${appPort}`,
  E2E_BASE_URL: `http://127.0.0.1:${appPort}`,
  E2E_BUSINESS_SLUG: 'skin-beauty',
  E2E_ALLOW_BOOKING: '1',
  E2E_EXPECT_MINIMUM: browserSelection ? '1' : '29',
  E2E_TARGETED: browserSelection ? '1' : '0',
  TEST_RUNTIME_DIR: runtime,
  ...(process.env.PLAYWRIGHT_BROWSERS_PATH
    ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH }
    : {}),
};
function run(command, args, overrides = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...env, ...overrides },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
}
let databaseStarted = false;
let app;
const visualAssets = resolve('public/images/visual-regression');
if (existsSync(visualAssets))
  throw new Error('Refusing to overwrite visual regression assets');
try {
  mkdirSync(visualAssets);
  cpSync('e2e/assets/hero-portrait.mp4', join(visualAssets, 'hero-portrait.mp4'));
  run(pg('initdb'), [
    '-D',
    join(runtime, 'pg'),
    '-U',
    'postgres',
    '-A',
    'trust',
    '--no-locale',
    '-E',
    'UTF8',
  ]);
  run(pg('pg_ctl'), [
    '-D',
    join(runtime, 'pg'),
    '-l',
    join(runtime, 'postgres.log'),
    '-o',
    `-h 127.0.0.1 -p ${port} -k ''`,
    '-w',
    'start',
  ]);
  databaseStarted = true;
  run(pg('createdb'), [
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'postgres',
    'torchick_test',
  ]);
  run(pg('createdb'), [
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'postgres',
    'torchick_test_upgrade',
  ]);
  run(process.execPath, ['node_modules/prisma/build/index.js', 'generate']);
  run(process.execPath, ['scripts/migrate-safe.mjs']);
  const upgrade = database.replace('/torchick_test?', '/torchick_test_upgrade?');
  const upgradeEnv = { DATABASE_URL: upgrade, TEST_DATABASE_URL: upgrade };
  run(process.execPath, ['scripts/migrate-safe.mjs', '--baseline-only'], upgradeEnv);
  const sql = [
    `INSERT INTO "User" ("id","email","updatedAt") VALUES ('upgrade-user','upgrade@example.invalid',now());`,
    `INSERT INTO "Business" ("id","slug","name","ownerId","updatedAt") VALUES ('upgrade-fixture','upgrade-fixture','Preserved business','upgrade-user',now());`,
    `INSERT INTO "StaffMember" ("id","businessId","userId","displayName","updatedAt") VALUES ('upgrade-staff','upgrade-fixture','upgrade-user','Preserved staff',now());`,
    `INSERT INTO "Client" ("id","businessId","userId","name","phone","updatedAt") VALUES ('upgrade-client','upgrade-fixture','upgrade-user','Preserved client','0509876333',now());`,
    `INSERT INTO "Appointment" ("id","businessId","clientId","staffId","startAt","endAt","status","totalPriceAgorot","confirmToken","updatedAt")
      VALUES ('upgrade-appointment','upgrade-fixture','upgrade-client','upgrade-staff','2026-01-01 08:00','2026-01-01 08:30','CONFIRMED',5000,'synthetic-upgrade-token',now());`,
    `INSERT INTO "Appointment" ("id","businessId","clientId","staffId","startAt","endAt","status","totalPriceAgorot","confirmToken","updatedAt")
      VALUES ('upgrade-conflict','upgrade-fixture','upgrade-client','upgrade-staff','2026-01-01 08:15','2026-01-01 08:45','CONFIRMED',6000,'synthetic-conflict-token',now());`,
    `CREATE TABLE test_migration_checksums AS SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;`,
  ].join('\n');
  run(pg('psql'), [
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'postgres',
    '-d',
    'torchick_test_upgrade',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    sql,
  ]);
  const blockedUpgrade = spawnSync(process.execPath, ['scripts/migrate-safe.mjs'], {
    env: { ...env, ...upgradeEnv },
    encoding: 'utf8',
  });
  if (blockedUpgrade.error) throw blockedUpgrade.error;
  if (blockedUpgrade.status === 0)
    throw new Error('Expected the legacy overlap to block the audit migration');
  const upgradeSql = (sql) =>
    run(pg('psql'), [
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
      '-U',
      'postgres',
      '-d',
      'torchick_test_upgrade',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ]);
  upgradeSql(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Business' AND column_name='listed')
      OR EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='MessageStatus' AND e.enumlabel='RESERVED')
      OR to_regclass('"BookingQuota"') IS NOT NULL
      OR to_regclass('"Client_businessId_phone_key"') IS NULL
      OR (SELECT count(*) FROM "Appointment" WHERE id IN ('upgrade-appointment','upgrade-conflict') AND status='CONFIRMED') <> 2
      OR NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20260906000000_booking_integrity' AND finished_at IS NULL AND rolled_back_at IS NULL)
    THEN RAISE EXCEPTION 'failed upgrade partially changed schema or data'; END IF;
  END $$;`);
  // Synthetic operator-approved reconciliation preserves the record and original booking.
  upgradeSql(`UPDATE "Appointment" SET status='CANCELLED' WHERE id='upgrade-conflict';`);
  run(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'migrate',
      'resolve',
      '--rolled-back',
      '20260906000000_booking_integrity',
    ],
    upgradeEnv,
  );
  run(process.execPath, ['scripts/migrate-safe.mjs'], upgradeEnv);
  run(pg('psql'), [
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'postgres',
    '-d',
    'torchick_test_upgrade',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM "Business" WHERE id='upgrade-fixture' AND name='Preserved business' AND "ownerId"='upgrade-user')
        OR NOT EXISTS (SELECT 1 FROM "Client" WHERE id='upgrade-client' AND "userId"='upgrade-user' AND "identityVerifiedAt" IS NULL AND phone='0509876333')
        OR NOT EXISTS (SELECT 1 FROM "Appointment" WHERE id='upgrade-appointment' AND "clientId"='upgrade-client'
          AND "staffId"='upgrade-staff' AND status='CONFIRMED' AND "totalPriceAgorot"=5000 AND "confirmToken"='synthetic-upgrade-token')
        OR NOT EXISTS (SELECT 1 FROM "Appointment" WHERE id='upgrade-conflict' AND status='CANCELLED' AND "totalPriceAgorot"=6000)
        OR (SELECT count(*) FROM test_migration_checksums) <> 37
        OR EXISTS (SELECT 1 FROM test_migration_checksums b LEFT JOIN "_prisma_migrations" m
          ON m.migration_name=b.migration_name AND m.checksum=b.checksum AND m.finished_at IS NOT NULL
          WHERE m.id IS NULL)
      THEN RAISE EXCEPTION 'upgrade lost data or changed applied migration checksums'; END IF;
    END $$;`,
  ]);
  run(process.execPath, ['scripts/migrate-safe.mjs'], upgradeEnv);
  if (!process.argv.includes('--migrations-only')) {
    run(process.execPath, ['--import', 'tsx', 'prisma/seed.ts']);
    if (comparePublic)
      run(process.execPath, ['--import', 'tsx', 'scripts/seed-visual-comparison.ts']);
    if (!process.argv.includes('--skip-static')) {
      run('npm', ['run', 'typecheck']);
      run('npm', ['run', 'lint']);
      run('npm', ['test'], { NODE_V8_COVERAGE: join(runtime, 'unit-v8') });
      run(process.execPath, [
        'scripts/coverage-report.mjs',
        join(runtime, 'unit-v8'),
        join(runtime, 'unit-coverage.json'),
        'unit',
        'all:20',
      ]);
    }
    const development = process.argv.includes('--development');
    if (!development && !process.argv.includes('--reuse-build'))
      run('npm', ['run', 'build']);
    const log = openSync(join(runtime, 'app.log'), 'w');
    if (!development) {
      cpSync('public', '.next/standalone/public', { recursive: true });
      cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
    }
    app = spawn(
      process.execPath,
      development
        ? [
            'node_modules/next/dist/bin/next',
            'dev',
            '-H',
            '127.0.0.1',
            '-p',
            String(appPort),
          ]
        : comparePublic
          ? [
              'node_modules/next/dist/bin/next',
              'start',
              '-H',
              '127.0.0.1',
              '-p',
              String(appPort),
            ]
          : ['.next/standalone/server.js'],
      {
        cwd: root,
        env: {
          ...env,
          NODE_ENV: development ? 'development' : 'production',
          PORT: String(appPort),
          HOSTNAME: '127.0.0.1',
        },
        detached: true,
        stdio: ['ignore', log, log],
      },
    );
    closeSync(log);
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (app.exitCode !== null)
        throw new Error(`App exited: ${readFileSync(join(runtime, 'app.log'), 'utf8')}`);
      try {
        const response = await fetch(`${env.E2E_BASE_URL}/api/version`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch (error) {
        if (error.name !== 'TypeError' && error.name !== 'TimeoutError') throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Isolated app readiness timed out');
    if (comparePublic) {
      run(process.execPath, ['--import', 'tsx', 'scripts/compare-public-ui.ts']);
    } else if (!browserSelection) {
      run('npm', ['run', 'test:integration'], {
        NODE_V8_COVERAGE: join(runtime, 'integration-v8'),
      });
      run(process.execPath, [
        'scripts/coverage-report.mjs',
        join(runtime, 'integration-v8'),
        join(runtime, 'integration-coverage.json'),
        'integration',
        'src/server/booking/policy.ts:70',
        'src/server/repos/appointments.ts:30',
      ]);
    }
    if (!comparePublic)
      run('npm', [
        'run',
        'test:e2e',
        ...(browserSelection ? ['--', browserSelection] : []),
      ]);
  }
  writeFileSync(
    join(runtime, 'success.json'),
    JSON.stringify({
      node: process.version,
      database: 'isolated',
      fullReleaseGate:
        !comparePublic &&
        !browserSelection &&
        !process.argv.some((arg) =>
          [
            '--skip-static',
            '--reuse-build',
            '--development',
            '--migrations-only',
          ].includes(arg),
        ),
      completedAt: new Date().toISOString(),
    }),
  );
  console.info(`Release regression artifacts: ${runtime}`);
} finally {
  if (app?.pid && app.exitCode === null) {
    process.kill(-app.pid, 'SIGTERM');
    await new Promise((resolve) => app.once('exit', resolve));
  }
  if (databaseStarted)
    run(pg('pg_ctl'), ['-D', join(runtime, 'pg'), '-m', 'fast', '-w', 'stop']);
  rmSync(visualAssets, { recursive: true, force: true });
}
