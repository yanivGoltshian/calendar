import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

// Preserve every historical migration byte/checksum. Only this already duplicated,
// single-statement enum migration can be resolved after proving its effect exists.
const duplicate = '20260827000000_add_business_plan_exclusive';
const path = `prisma/migrations/${duplicate}/migration.sql`;
const sql = readFileSync(path, 'utf8');
const statements = sql.replace(/--[^\n]*/g, '').trim();
if (statements !== 'ALTER TYPE "BusinessPlan" ADD VALUE \'exclusive\';') {
  throw new Error('Historical migration changed; manual review required');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const host = new URL(process.env.DATABASE_URL).hostname;
if (
  !['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(host) &&
  !process.argv.includes('--allow-nonlocal')
) {
  throw new Error('Nonlocal migration requires explicit --allow-nonlocal authorization');
}
let baselineDirectory;
const legacyBaseline = process.argv.includes('--baseline-only');
const provisioningBaseline = process.argv.includes('--provisioning-baseline-only');
if (legacyBaseline && provisioningBaseline) throw new Error('Choose one isolated migration baseline');
if (legacyBaseline || provisioningBaseline) {
  if (
    process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL ||
    !['localhost', '127.0.0.1'].includes(host)
  ) {
    throw new Error('Baseline simulation requires the explicitly isolated test database');
  }
  baselineDirectory = mkdtempSync(join(tmpdir(), 'torchick-baseline-'));
  cpSync('prisma/schema.prisma', join(baselineDirectory, 'schema.prisma'));
  mkdirSync(join(baselineDirectory, 'migrations'));
  for (const entry of readdirSync('prisma/migrations')) {
    if (entry < (provisioningBaseline ? '20260912230000' : '20260906000000') || entry === 'migration_lock.toml') {
      cpSync(
        join('prisma/migrations', entry),
        join(baselineDirectory, 'migrations', entry),
        { recursive: true },
      );
    }
  }
}
function run(args) {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'migrate',
      ...args,
      ...(baselineDirectory
        ? ['--schema', join(baselineDirectory, 'schema.prisma')]
        : []),
    ],
    {
      stdio: 'inherit',
      env: process.env,
    },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}
const db = new PrismaClient();
try {
  const status = run(['deploy']);
  if (status !== 0) {
    const failed = await db.$queryRaw`
      SELECT migration_name, checksum, logs FROM "_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
    const expectedHash = createHash('sha256').update(sql).digest('hex');
    const [row] = failed;
    if (
      failed.length !== 1 ||
      row.migration_name !== duplicate ||
      row.checksum !== expectedHash ||
      !/42710/.test(row.logs ?? '')
    ) {
      throw new Error(
        'Migration failure is not the known duplicate enum; manual recovery required',
      );
    }
    const [enumState] = await db.$queryRaw`
      SELECT count(*)::int AS count FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
      JOIN pg_namespace n ON t.typnamespace=n.oid
      WHERE t.typname='BusinessPlan' AND e.enumlabel='exclusive' AND n.nspname=current_schema()`;
    if (enumState.count !== 1)
      throw new Error('Expected enum effect missing; refusing resolution');
    console.info(
      'migration_recovery: verified duplicate enum effect and original checksum',
    );
    if (
      run(['resolve', '--rolled-back', duplicate]) !== 0 ||
      run(['resolve', '--applied', duplicate]) !== 0 ||
      run(['deploy']) !== 0
    )
      throw new Error('Migration recovery failed');
  }
} finally {
  await db.$disconnect();
  if (baselineDirectory) rmSync(baselineDirectory, { recursive: true });
}
