import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from './fixtures';
import { createCategorizedService, saveServiceCategories } from '../src/server/repos/serviceCategories';
import { publicServiceCategories, readServiceCategories } from '../src/lib/serviceCategories';

after(() => prisma.$disconnect());

test('new onboarding services and their category membership are created together with existing staff defaults', async () => {
  const f = await bookingFixture();
  try {
    await saveServiceCategories(f.business.id, {
      revision: 0, enabled: true,
      categories: [{ id: 'care', name: 'Care', serviceIds: [] }],
    });
    const input = {
      name: 'Synthetic new categorized service', durationMin: 30, priceAgorot: 5000,
      description: null, hidden: false, hidePrice: false, hideDuration: false,
    };
    assert.deepEqual(await createCategorizedService(f.business.id, input, 'foreign-category'), {
      ok: false, error: 'invalid_category',
    });
    assert.equal(await prisma.service.count({ where: { businessId: f.business.id } }), 1);
    const created = await createCategorizedService(f.business.id, input, 'care');
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('Expected created categorized service');
    const config = readServiceCategories((await prisma.business.findUniqueOrThrow({
      where: { id: f.business.id },
    })).serviceCategories);
    assert.deepEqual(config.categories[0].serviceIds, [created.service.id]);
    assert.equal(config.revision, 2);
    assert.deepEqual((await prisma.serviceStaff.findMany({ where: { serviceId: created.service.id } }))
      .map(link => link.staffId), [f.staff.id]);
    await saveServiceCategories(f.business.id, { ...config, enabled: false });
    assert.deepEqual(await createCategorizedService(f.business.id, input, 'care'), {
      ok: false, error: 'invalid_category',
    });
    assert.equal(await prisma.service.count({ where: { businessId: f.business.id } }), 2);
  } finally {
    await cleanupFixture(f);
  }
});

test('category persistence is tenant scoped and preserves page content, services and disabled assignments', async () => {
  const f = await bookingFixture();
  const foreign = await bookingFixture();
  try {
    const original = await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } });
    assert.equal(original.serviceCategories, null);
    const config = {
      revision: 0, enabled: true,
      categories: [{ id: 'care', name: 'Care', serviceIds: [f.service.id] }],
    };
    assert.deepEqual(await saveServiceCategories(f.business.id, {
      ...config, categories: [{ id: 'care', name: 'Care', serviceIds: [foreign.service.id] }],
    }), { ok: false, error: 'invalid_service' });
    const saved = await saveServiceCategories(f.business.id, config);
    assert.equal(saved.ok, true);
    if (!saved.ok) throw new Error('Expected saved categories');
    assert.equal(saved.categories.revision, 1);
    assert.deepEqual(await saveServiceCategories(f.business.id, config), { ok: false, error: 'conflict' });
    const disabled = await saveServiceCategories(f.business.id, { ...saved.categories, enabled: false });
    assert.equal(disabled.ok, true);
    const after = await prisma.business.findUniqueOrThrow({ where: { id: f.business.id } });
    assert.deepEqual(after.landingContent, original.landingContent);
    assert.equal(after.publicPageStyle, original.publicPageStyle);
    assert.deepEqual(readServiceCategories(after.serviceCategories).categories, config.categories);
    assert.deepEqual(publicServiceCategories(readServiceCategories(after.serviceCategories), [f.service]), []);
    assert.equal(await prisma.service.count({ where: { businessId: f.business.id } }), 1);
    assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: foreign.business.id } })).serviceCategories, null);
  } finally {
    await cleanupFixture(f);
    await cleanupFixture(foreign);
  }
});

test('concurrent category editors cannot overwrite each other', async () => {
  const f = await bookingFixture();
  try {
    const results = await Promise.all(['First', 'Second'].map(name => saveServiceCategories(f.business.id, {
      revision: 0, enabled: true,
      categories: [{ id: 'care', name, serviceIds: [f.service.id] }],
    })));
    assert.equal(results.filter(result => result.ok).length, 1);
    assert.deepEqual(results.find(result => !result.ok), { ok: false, error: 'conflict' });
    const saved = readServiceCategories((await prisma.business.findUniqueOrThrow({
      where: { id: f.business.id },
    })).serviceCategories);
    assert.equal(saved.revision, 1);
    const winner = results.find(result => result.ok);
    assert.deepEqual(saved, winner?.categories);
  } finally {
    await cleanupFixture(f);
  }
});
