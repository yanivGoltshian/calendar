import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { prisma } from '../src/lib/db';
import { ENGAGEMENT_SEGMENTS } from '../src/lib/clientEngagement';
import { clientEngagementTags, clientSegmentWhere } from '../src/server/clientSegments';
import { listClients } from '../src/server/repos/clients';
import { countSegment, resolveSegmentClients } from '../src/server/repos/marketing';
import { bookingFixture, cleanupFixture } from './fixtures';
import { seedEngagementClients } from './engagement-fixtures';

after(() => prisma.$disconnect());

test('client filters, badges and campaign audiences use the same tenant-isolated categories', async () => {
  const f = await bookingFixture();
  const other = await bookingFixture();
  try {
    const clients = await seedEngagementClients(f);
    await seedEngagementClients(other);
    const expected = {
      recent_bookers: [clients.recent.id], returning: [clients.recent.id], past_clients: [clients.past.id],
    };
    for (const segment of ENGAGEMENT_SEGMENTS) {
      const list = await listClients(f.business.id, { filter: segment });
      assert.deepEqual(list.map(client => client.id), expected[segment]);
      assert.ok(list.every(client => client.engagementTags.includes(segment)));
      assert.equal(await countSegment(f.business.id, segment), list.length);
      assert.deepEqual((await resolveSegmentClients(f.business.id, segment)).map(client => client.id),
        expected[segment]);
    }
    const all = await listClients(f.business.id);
    assert.deepEqual(all.find(client => client.id === clients.recent.id)?.engagementTags,
      ['recent_bookers', 'returning']);
    assert.deepEqual(all.find(client => client.id === clients.cancelled.id)?.engagementTags, []);
    assert.deepEqual(all.find(client => client.id === clients.unvisited.id)?.engagementTags, []);
    assert.equal(await countSegment(f.business.id, 'active'), 3);
    assert.equal((await listClients(f.business.id, { filter: 'blocked' }))[0].id, clients.cancelled.id);
  } finally {
    await cleanupFixture(f);
    await cleanupFixture(other);
  }
});

test('engagement uses inclusive 30/90-day booking boundaries and real past visit statuses', async () => {
  const f = await bookingFixture();
  const now = new Date();
  try {
    const cases = [
      { age: 30 * 86_400_000, status: 'CONFIRMED' as const, past: false, tags: ['recent_bookers'] },
      { age: 30 * 86_400_000 + 1, status: 'CONFIRMED' as const, past: false, tags: [] },
      { age: 90 * 86_400_000, status: 'DONE' as const, past: true, tags: [] },
      { age: 90 * 86_400_000 + 1, status: 'DONE' as const, past: true, tags: ['past_clients'] },
      { age: 91 * 86_400_000, status: 'ARRIVED' as const, past: true, tags: ['past_clients'] },
      { age: 91 * 86_400_000, status: 'DONE' as const, past: false, tags: [] },
      { age: 91 * 86_400_000, status: 'CONFIRMED' as const, past: true, tags: [] },
      { age: 0, status: 'CANCELLED' as const, past: true, tags: [] },
    ];
    const expected = new Map<string, string[]>();
    for (const [index, entry] of cases.entries()) {
      const client = await prisma.client.create({ data: { businessId: f.business.id, name: `Boundary ${index}` } });
      const startAt = new Date(now.getTime() + (entry.past ? -100 : 1) * 86_400_000 + index * 3_600_000);
      await prisma.appointment.create({ data: {
        businessId: f.business.id, staffId: f.staff.id, clientId: client.id,
        startAt, endAt: new Date(startAt.getTime() + 30 * 60_000),
        createdAt: new Date(now.getTime() - entry.age), status: entry.status, totalPriceAgorot: 0,
      } });
      expected.set(client.id, entry.tags);
    }
    const tags = await clientEngagementTags(f.business.id, [...expected.keys()], now);
    for (const [id, values] of expected) assert.deepEqual(tags.get(id) ?? [], values);
    for (const segment of ENGAGEMENT_SEGMENTS) {
      const rows = await prisma.client.findMany({ where: await clientSegmentWhere(f.business.id, segment, now) });
      assert.deepEqual(rows.map(row => row.id).sort(),
        [...expected].filter(([, values]) => values.includes(segment)).map(([id]) => id).sort());
    }
  } finally {
    await cleanupFixture(f);
  }
});
