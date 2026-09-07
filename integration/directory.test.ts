import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/db';
import {
  countListedBusinesses,
  getListedBusinesses,
} from '../src/server/repos/publicDirectory';
import { bookingFixture, cleanupFixture, requireIsolatedDatabase } from './fixtures';

requireIsolatedDatabase();

test('directory, HTTP navigation gate and sitemap share explicit publication and lifecycle eligibility', async () => {
  const fixtures: Awaited<ReturnType<typeof bookingFixture>>[] = [];
  const base = process.env.E2E_BASE_URL;
  assert.ok(base);
  const gate = async () => {
    const response = await fetch(`${base}/api/public/directory-status`);
    assert.equal(response.status, 200);
    return (await response.json()).visible;
  };
  try {
    assert.equal(await countListedBusinesses(), 0);
    assert.equal(await gate(), false);
    for (let index = 0; index < 3; index++) {
      const f = await bookingFixture();
      fixtures.push(f);
      assert.equal(f.business.listed, false);
      await prisma.business.update({
        where: { id: f.business.id },
        data: { listed: true },
      });
      assert.equal(
        await countListedBusinesses(),
        index,
        'incomplete onboarding remains unlisted',
      );
      await prisma.businessSettings.update({
        where: { businessId: f.business.id },
        data: { onboardingCompleted: true },
      });
      assert.equal(await countListedBusinesses(), index + 1);
      assert.equal(await gate(), index === 2);
    }
    const f = fixtures[0];
    const variants: Prisma.BusinessUpdateInput[] = [
      { listed: false },
      { accountStatus: 'PENDING_DELETION' },
      { settings: { update: { onboardingCompleted: false } } },
      { paidUntil: new Date(0) },
    ];
    for (const data of variants) {
      await prisma.business.update({ where: { id: f.business.id }, data });
      assert.equal(
        (await getListedBusinesses()).some(
          (business) => business.slug === f.business.slug,
        ),
        false,
      );
      assert.equal(await gate(), false);
      assert.doesNotMatch(
        await (await fetch(`${base}/sitemap.xml`)).text(),
        new RegExp(f.business.slug),
      );
      await prisma.business.update({
        where: { id: f.business.id },
        data: {
          listed: true,
          accountStatus: 'ACTIVE',
          paidUntil: f.business.paidUntil,
          settings: { update: { onboardingCompleted: true } },
        },
      });
    }
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    for (const fixture of fixtures)
      assert.match(sitemap, new RegExp(`/b/${fixture.business.slug}`));
  } finally {
    for (const fixture of fixtures.reverse()) await cleanupFixture(fixture);
  }
});

test('actual sitemap HTTP failure never publishes a success-shaped empty business index', async () => {
  const base = process.env.E2E_BASE_URL;
  assert.ok(base);
  // An isolated schema fault exercises the compiled handler's real database failure path.
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Business" RENAME TO "test_unavailable_business"',
  );
  try {
    const response = await fetch(`${base}/sitemap.xml`);
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /<urlset/);
    const directory = await fetch(`${base}/api/public/directory-status`);
    assert.equal(directory.status, 503);
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "test_unavailable_business" RENAME TO "Business"',
    );
  }
  assert.equal((await fetch(`${base}/sitemap.xml`)).status, 200);
});
