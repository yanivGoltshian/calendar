import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MessageStatus, Prisma } from '@prisma/client';
import { deliverEmailOnce, type EmailDeliveryDeps } from './emailDelivery';

type Database = NonNullable<EmailDeliveryDeps['prismaClient']>;
type Row = { id: string; status: MessageStatus; error: string | null; reservedAt: Date | null };
const request = { businessId: 'business', idempotencyKey: 'reminder:appointment:email',
  to: 'client@example.test', subject: 'Reminder', text: 'Reminder' };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function fixture() {
  let row: Row | null = null;
  let transaction = Promise.resolve();
  let now = Date.now(), providerCalls = 0;
  const faults = { cleanup: false, finalization: false };
  const hooks = { beforeReclaim: async () => {} };
  function apply(data: Prisma.MessageLogUncheckedCreateInput | Prisma.MessageLogUncheckedUpdateInput) {
    assert.ok(row);
    if (typeof data.status === 'string') row.status = data.status;
    if (typeof data.error === 'string' || data.error === null) row.error = data.error;
    if (data.reservedAt instanceof Date) row.reservedAt = data.reservedAt;
    return { ...row };
  }
  const messageLog: Database['messageLog'] = {
    findUnique: async () => row && { ...row },
    create: async ({ data }) => {
      row = { id: 'outbox', status: 'RESERVED', error: null, reservedAt: null };
      return apply(data);
    },
    update: async ({ data }) => apply(data),
    updateMany: async ({ where, data }) => {
      if ((faults.cleanup && data?.status === 'FAILED') || (faults.finalization && data?.status === 'SENT')) {
        throw new Error('database unavailable');
      }
      const error = where?.error;
      const markers = typeof error === 'string' ? [error]
        : error && typeof error === 'object' && Array.isArray(error.in) ? error.in : [];
      if (!row || where?.id !== row.id || where.status !== row.status || row.error === null || !markers.includes(row.error)) {
        return { count: 0 };
      }
      apply(data);
      return { count: 1 };
    },
  };
  const db: Database = {
    messageLog,
    $transaction: async (work) => {
      const previous = transaction;
      const lock = deferred();
      transaction = lock.promise;
      await previous;
      try { return await work({
        messageLog: { ...messageLog, updateMany: async (args) => {
          await hooks.beforeReclaim();
          return messageLog.updateMany(args);
        } },
        $executeRaw: async () => 1,
      }); }
      finally { lock.resolve(); }
    },
  };
  const deps: EmailDeliveryDeps = {
    prismaClient: db, configured: true, now: () => new Date(now),
    canDeliverEmail: async () => true, send: async () => { providerCalls++; },
  };
  return { deps, faults, hooks, row: () => row, providerCalls: () => providerCalls,
    expire: () => { now += 6 * 60 * 1000; } };
}

test('final eligibility DB failure releases only the preparatory reservation and retries', async () => {
  const f = fixture();
  let checks = 0;
  const failed = await deliverEmailOnce(request, {
    ...f.deps, canDeliverEmail: async () => {
      if (++checks === 2) throw new Error('eligibility DB unavailable');
      return true;
    },
  });
  assert.deepEqual(failed, { status: 'failed', reason: 'preparation_failed' });
  assert.equal(f.providerCalls(), 0);
  assert.equal(f.row()?.status, 'FAILED');
  assert.deepEqual(await deliverEmailOnce(request, f.deps), { status: 'sent' });
  assert.equal(f.providerCalls(), 1);
});

test('cleanup failure leaves a recoverable preparation lease, not dispatch uncertainty', async () => {
  const f = fixture();
  f.faults.cleanup = true;
  let checks = 0;
  await deliverEmailOnce(request, { ...f.deps, canDeliverEmail: async () => {
    if (++checks === 2) throw new Error('eligibility DB unavailable');
    return true;
  } });
  assert.match(f.row()?.error ?? '', /^preparing:/);
  assert.deepEqual(await deliverEmailOnce(request, f.deps), { status: 'failed', reason: 'preparation_in_progress' });
  assert.equal(f.providerCalls(), 0);
  f.expire();
  await Promise.all([deliverEmailOnce(request, f.deps), deliverEmailOnce(request, f.deps)]);
  assert.equal(f.row()?.status, 'SENT');
  assert.equal(f.providerCalls(), 1);
});

for (const staleFailure of [true, false]) {
  test(`a stale preparer cannot ${staleFailure ? 'release' : 'dispatch'} its replacement owner's claim`, { timeout: 5000 }, async () => {
    const f = fixture(), entered = deferred(), resume = deferred(), replacementEntered = deferred(), replacementResume = deferred();
    let oldChecks = 0, newChecks = 0;
    const old = deliverEmailOnce(request, { ...f.deps, canDeliverEmail: async () => {
      if (++oldChecks === 2) {
        entered.resolve(); await resume.promise;
        if (staleFailure) throw new Error('old eligibility failed');
      }
      return true;
    } });
    await entered.promise;
    const oldMarker = f.row()?.error;
    f.expire();
    const replacement = deliverEmailOnce(request, { ...f.deps, canDeliverEmail: async () => {
      if (++newChecks === 2) { replacementEntered.resolve(); await replacementResume.promise; }
      return true;
    } });
    await replacementEntered.promise;
    const replacementMarker = f.row()?.error;
    assert.notEqual(replacementMarker, oldMarker);
    resume.resolve();
    assert.equal((await old).status, 'failed');
    assert.equal(f.row()?.error, replacementMarker);
    assert.equal(f.providerCalls(), 0);
    replacementResume.resolve();
    assert.equal((await replacement).status, 'sent');
    assert.equal(f.providerCalls(), 1);
  });
}

test('reclaim CAS cannot steal an owner that dispatched after the stale reservation was read', { timeout: 5000 }, async () => {
  const f = fixture(), prepared = deferred(), resumeOwner = deferred(), reclaimRead = deferred(), resumeReclaim = deferred();
  const providerEntered = deferred(), providerResume = deferred();
  let checks = 0, providerCalls = 0;
  const old = deliverEmailOnce(request, { ...f.deps,
    canDeliverEmail: async () => {
      if (++checks === 2) { prepared.resolve(); await resumeOwner.promise; }
      return true;
    },
    send: async () => { providerCalls++; providerEntered.resolve(); await providerResume.promise; },
  });
  await prepared.promise;
  f.expire();
  f.hooks.beforeReclaim = async () => { reclaimRead.resolve(); await resumeReclaim.promise; };
  const replacement = deliverEmailOnce(request, { ...f.deps, send: async () => { providerCalls++; } });
  await reclaimRead.promise;
  resumeOwner.resolve();
  await providerEntered.promise;
  resumeReclaim.resolve();
  assert.deepEqual(await replacement, { status: 'failed', reason: 'preparation_claim_lost' });
  assert.match(f.row()?.error ?? '', /^dispatching:/);
  assert.equal(providerCalls, 1);
  providerResume.resolve();
  assert.equal((await old).status, 'sent');
});

test('provider and finalization uncertainty never become reclaimable when their leases age', async () => {
  for (const failure of ['provider', 'finalization']) {
    const f = fixture();
    f.faults.finalization = failure === 'finalization';
    let providerCalls = 0;
    const deps = { ...f.deps, send: async () => {
      providerCalls++;
      if (failure === 'provider') throw new Error('response lost after possible acceptance');
    } };
    assert.equal((await deliverEmailOnce(request, deps)).status, 'unknown');
    f.expire();
    assert.equal((await deliverEmailOnce(request, deps)).status, 'unknown');
    assert.equal(providerCalls, 1);
  }
});
