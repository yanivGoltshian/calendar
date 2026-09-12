import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from './fixtures';
import { createService, deleteService, seedServicesForBusiness } from '../src/server/repos/services';
import { bookingPolicy } from '../src/server/booking/policy';
import { formatDateString } from '../src/lib/time';

after(() => prisma.$disconnect());

const serviceInput = {
  name: 'New synthetic service', description: null, durationMin: 15, priceAgorot: 1000,
  hidePrice: false, hideDuration: false, hidden: false,
};

test('unused services delete their own assignments and remain scoped to their business', async () => {
  const f = await bookingFixture();
  try {
    assert.deepEqual(await deleteService('foreign-business', f.service.id), { ok: false, reason: 'not_found' });
    assert.deepEqual(await deleteService(f.business.id, f.service.id), { ok: true });
    assert.equal(await prisma.serviceStaff.count({ where: { serviceId: f.service.id } }), 0);
  } finally {
    await cleanupFixture(f);
  }
});

for (const dependency of ['waitlist', 'punchcard', 'sale', 'appointment']) {
  test(`onboarding cleanup preserves a service referenced by ${dependency}`, async () => {
    const f = await bookingFixture();
    try {
      if (dependency === 'waitlist') {
        await prisma.waitlistEntry.create({ data: {
          businessId: f.business.id, serviceId: f.service.id, name: 'Synthetic waitlist', phone: '0501234567',
        } });
      } else if (dependency === 'punchcard') {
        await prisma.punchCard.create({ data: {
          businessId: f.business.id, serviceId: f.service.id, clientId: f.client.id, totalPunches: 5,
        } });
      } else if (dependency === 'sale') {
        await prisma.sale.create({ data: {
          businessId: f.business.id, items: { create: {
            kind: 'SERVICE', serviceId: f.service.id, nameSnapshot: f.service.name,
            unitPriceAgorot: 1000, lineTotalAgorot: 1000,
          } },
        } });
      } else {
        await prisma.appointment.create({ data: {
          businessId: f.business.id, clientId: f.client.id, staffId: f.staff.id,
          startAt: f.input.startAt, endAt: f.input.endAt, totalPriceAgorot: f.service.priceAgorot,
          services: { create: {
            serviceId: f.service.id, nameSnapshot: f.service.name,
            durationMinSnapshot: f.service.durationMin, priceAgorotSnapshot: f.service.priceAgorot,
          } },
        } });
      }
      assert.deepEqual(await deleteService(f.business.id, f.service.id), { ok: false, reason: 'in_use' });
      assert.ok(await prisma.service.findUnique({ where: { id: f.service.id } }));
      assert.equal(await prisma.serviceStaff.count({ where: { serviceId: f.service.id } }), 1);
    } finally {
      await cleanupFixture(f);
    }
  });
}

test('new custom services immediately support real availability for a sole active staff member', async () => {
  const f = await bookingFixture();
  try {
    const service = await createService(f.business.id, serviceInput);
    const links = await prisma.serviceStaff.findMany({ where: { serviceId: service.id } });
    assert.deepEqual(links.map(link => link.staffId), [f.staff.id]);
    const policy = await bookingPolicy(f.business.id, f.staff.id, [service.id],
      formatDateString(f.startAt, f.business.timezone));
    assert.ok(policy.slots.length > 0);
  } finally {
    await cleanupFixture(f);
  }
});

test('template services and their sole-staff assignments are seeded together exactly once', async () => {
  const f = await bookingFixture();
  try {
    await prisma.service.deleteMany({ where: { businessId: f.business.id } });
    const count = await seedServicesForBusiness(f.business.id, 'BARBERSHOP');
    assert.ok(count > 0);
    const services = await prisma.service.findMany({
      where: { businessId: f.business.id }, include: { staffLinks: true },
    });
    assert.equal(services.length, count);
    for (const service of services) assert.deepEqual(service.staffLinks.map(link => link.staffId), [f.staff.id]);
    assert.equal(await seedServicesForBusiness(f.business.id, 'BARBERSHOP'), 0);
  } finally {
    await cleanupFixture(f);
  }
});

test('multiple staff require explicit assignment and foreign or inactive staff cannot be assigned', async () => {
  const f = await bookingFixture();
  const other = await bookingFixture();
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.invalid` } });
  try {
    const second = await prisma.staffMember.create({
      data: { businessId: f.business.id, userId: user.id, displayName: 'Second synthetic staff' },
    });
    const unassigned = await createService(f.business.id, serviceInput);
    assert.equal(await prisma.serviceStaff.count({ where: { serviceId: unassigned.id } }), 0);
    const assigned = await createService(f.business.id, serviceInput, [second.id]);
    assert.deepEqual((await prisma.serviceStaff.findMany({ where: { serviceId: assigned.id } }))
      .map(link => link.staffId), [second.id]);
    const count = await prisma.service.count({ where: { businessId: f.business.id } });
    await assert.rejects(createService(f.business.id, serviceInput, [other.staff.id]), /invalid_service_staff/);
    await prisma.staffMember.update({ where: { id: second.id }, data: { active: false } });
    await assert.rejects(createService(f.business.id, serviceInput, [second.id]), /invalid_service_staff/);
    assert.equal(await prisma.service.count({ where: { businessId: f.business.id } }), count);
  } finally {
    await cleanupFixture(f);
    await cleanupFixture(other);
    await prisma.user.delete({ where: { id: user.id } });
  }
});
