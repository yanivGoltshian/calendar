import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db';
import { BusinessReviewError } from '../src/lib/businessReviews';
import {
  addManualReview,
  countPendingBusinessReviews,
  getReviewEligibility,
  listPublicBusinessReviews,
  submitCustomerReview,
  updateBusinessReview,
} from '../src/server/repos/businessReviews';
import { bookingFixture, cleanupFixture } from './fixtures';

after(() => prisma.$disconnect());

test('customer review creation is tenant/identity/status guarded, unique and private until owner approval', async () => {
  const f = await bookingFixture();
  const other = await bookingFixture();
  const user = await prisma.user.create({
    data: { email: `${randomUUID()}@example.invalid` },
  });
  const input = { name: 'Synthetic reviewer', rating: 4, text: 'Original customer text' };
  try {
    const appointment = await prisma.appointment.create({
      data: {
        businessId: f.business.id,
        staffId: f.staff.id,
        clientId: f.client.id,
        startAt: new Date(Date.now() - 86_400_000),
        endAt: new Date(Date.now() - 85_000_000),
        status: 'DONE',
      },
    });
    const submit = (businessId = f.business.id, userId = user.id) =>
      submitCustomerReview(businessId, userId, appointment.id, input);
    await assert.rejects(submit, { code: 'ineligible' });
    await prisma.client.update({ where: { id: f.client.id }, data: { userId: user.id } });
    await assert.rejects(submit, { code: 'ineligible' });
    await prisma.client.update({
      where: { id: f.client.id },
      data: { identityVerifiedAt: new Date() },
    });
    await assert.rejects(() => submit(other.business.id), { code: 'ineligible' });
    await assert.rejects(() => submit(f.business.id, other.staff.userId!), {
      code: 'ineligible',
    });
    for (const status of ['PENDING', 'CONFIRMED', 'ARRIVED', 'CANCELLED'] as const) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status },
      });
      await assert.rejects(submit, { code: 'ineligible' });
    }
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'DONE', endAt: new Date(Date.now() + 60_000) },
    });
    await assert.rejects(submit, { code: 'ineligible' });
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { endAt: new Date(Date.now() - 60_000) },
    });
    assert.equal(
      (await getReviewEligibility(f.business.id, user.id)).appointments.length,
      1,
    );
    const concurrent = await Promise.allSettled([submit(), submit()]);
    assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
    for (const result of concurrent) {
      if (result.status === 'rejected') {
        assert.ok(result.reason instanceof BusinessReviewError);
        assert.ok(['already_submitted', 'conflict'].includes(result.reason.code));
      }
    }
    const row = await prisma.businessReview.findUniqueOrThrow({
      where: { appointmentId: appointment.id },
    });
    assert.equal(row.status, 'PENDING');
    assert.equal(row.origin, 'CUSTOMER');
    assert.equal(row.authorUserId, user.id);
    assert.equal(await countPendingBusinessReviews(f.business.id), 1);
    assert.equal(await countPendingBusinessReviews(other.business.id), 0);
    assert.deepEqual(await listPublicBusinessReviews(f.business.id), []);
    assert.equal(
      (await getReviewEligibility(f.business.id, user.id)).appointments.length,
      0,
    );
    const edit = {
      id: row.id,
      version: 0,
      rating: 4,
      text: 'Approved shortened text',
      status: 'PUBLISHED',
    };
    await assert.rejects(() => updateBusinessReview(other.business.id, edit), {
      code: 'not_found',
    });
    await assert.rejects(
      () => updateBusinessReview(f.business.id, { ...edit, rating: 5 }),
      { code: 'rating_locked' },
    );
    await updateBusinessReview(f.business.id, edit);
    const publicRows = await listPublicBusinessReviews(f.business.id);
    assert.deepEqual(publicRows, [
      {
        id: row.id,
        name: input.name,
        rating: 4,
        quote: edit.text,
        editedByBusiness: true,
        originalQuote: input.text,
      },
    ]);
    for (const privateValue of [user.id, appointment.id, f.business.id]) {
      assert.ok(!JSON.stringify(publicRows).includes(privateValue));
    }
    await assert.rejects(() => updateBusinessReview(f.business.id, edit), {
      code: 'conflict',
    });
    await updateBusinessReview(f.business.id, { ...edit, version: 1, status: 'HIDDEN' });
    assert.deepEqual(await listPublicBusinessReviews(f.business.id), []);
    assert.equal(
      (await prisma.businessReview.findUniqueOrThrow({ where: { id: row.id } }))
        .originalText,
      input.text,
    );
  } finally {
    await cleanupFixture(f);
    await cleanupFixture(other);
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('manual reviews retain owner origin, accept rating-only text and deduplicate exact retries', async () => {
  const f = await bookingFixture();
  try {
    const input = {
      name: 'Synthetic manual review',
      rating: 5,
      text: '   ',
      status: 'PUBLISHED',
      requestKey: randomUUID(),
      origin: 'CUSTOMER',
      authorUserId: 'forged',
      source: { provider: 'google' },
    };
    const first = await addManualReview(f.business.id, input);
    const retry = await addManualReview(f.business.id, input);
    assert.equal(first.created, true);
    assert.equal(retry.created, false);
    assert.equal(first.id, retry.id);
    assert.equal(
      await prisma.businessReview.count({ where: { businessId: f.business.id } }),
      1,
    );
    await assert.rejects(() => addManualReview(f.business.id, { ...input, rating: 1 }), {
      code: 'conflict',
    });
    const row = await prisma.businessReview.findUniqueOrThrow({
      where: { id: first.id },
    });
    assert.equal(row.origin, 'OWNER');
    assert.equal(row.authorUserId, null);
    assert.equal(row.appointmentId, null);
    assert.equal(row.text, '');
    await updateBusinessReview(f.business.id, {
      id: row.id,
      version: 0,
      rating: 3,
      text: '',
      status: 'PUBLISHED',
    });
    assert.deepEqual(await listPublicBusinessReviews(f.business.id), [
      { id: row.id, name: input.name, rating: 3, quote: '', editedByBusiness: false },
    ]);
    await prisma.business.update({
      where: { id: f.business.id },
      data: { accountStatus: 'PENDING_DELETION' },
    });
    assert.deepEqual(await listPublicBusinessReviews(f.business.id), []);
  } finally {
    await cleanupFixture(f);
  }
});
