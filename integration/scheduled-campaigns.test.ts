import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { prisma } from '../src/lib/db';
import { handleCampaignCron, type CampaignCronDeps } from '../src/app/api/cron/campaigns/handler';
import { createCampaign, getDueScheduledCampaigns, sendCampaign } from '../src/server/repos/marketing';
import { deliverEmailOnce } from '../src/server/billing/emailDelivery';
import { bookingFixture, cleanupFixture } from './fixtures';

after(() => prisma.$disconnect());

test('scheduled campaigns use real due selection and atomic delivery claims with observable provider failures', async () => {
  const f = await bookingFixture();
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'isolated-campaign-test';
  try {
    await prisma.client.update({ where: { id: f.client.id }, data: { email: 'synthetic@example.invalid' } });
    const input = { name: 'Synthetic campaign', body: 'Isolated only', segment: 'active' as const, channels: ['email' as const] };
    const due = await createCampaign(f.business.id, { ...input, scheduledAt: new Date(Date.now() - 60_000) });
    const rejected = await createCampaign(f.business.id, { ...input, scheduledAt: new Date(Date.now() - 30_000) });
    const future = await createCampaign(f.business.id, { ...input, scheduledAt: new Date(Date.now() + 86_400_000) });
    const calls: string[] = [];
    const deps: CampaignCronDeps = {
      getDueScheduledCampaigns,
      sendCampaign: (businessId, id) => {
        assert.equal(businessId, f.business.id);
        return sendCampaign(businessId, id, {
          deliverEmailOnce: request => deliverEmailOnce(request, {
            configured: true,
            send: async () => {
              calls.push(id);
              if (id === rejected.id) throw Object.assign(new Error('Synthetic pre-send rejection'), { code: 'ECONNREFUSED' });
            },
          }),
          sendGuardedSms: async () => { throw new Error('No SMS delivery is authorized in this test'); },
        });
      },
    };
    const request = () => new Request('http://localhost/api/cron/campaigns', {
      method: 'POST', headers: { 'x-cron-secret': 'isolated-campaign-test' },
    });
    const unauthorized = await handleCampaignCron(new Request('http://localhost/api/cron/campaigns', { method: 'POST' }), deps);
    assert.equal(unauthorized.status, 401);
    assert.equal(calls.length, 0);
    const responses = await Promise.all([handleCampaignCron(request(), deps), handleCampaignCron(request(), deps)]);
    const bodies = await Promise.all(responses.map(response => response.json()));
    assert.ok(responses.every(response => response.status === 200));
    assert.equal(bodies.reduce((sum, body) => sum + body.counts.messagesSent, 0), 1);
    assert.equal(bodies.reduce((sum, body) => sum + body.counts.messagesFailed, 0), 1);
    assert.deepEqual(calls.sort(), [due.id, rejected.id].sort());
    assert.equal((await prisma.campaign.findUniqueOrThrow({ where: { id: due.id } })).status, 'SENT');
    assert.equal((await prisma.campaign.findUniqueOrThrow({ where: { id: rejected.id } })).status, 'FAILED');
    assert.equal((await prisma.campaign.findUniqueOrThrow({ where: { id: future.id } })).status, 'SCHEDULED');
    const log = await prisma.messageLog.findMany({ where: { businessId: f.business.id } });
    assert.equal(log.filter(row => row.status === 'SENT').length, 1);
    assert.equal(log.filter(row => row.status === 'FAILED' && row.error === 'provider_rejected').length, 1);
    assert.equal((await (await handleCampaignCron(request(), deps)).json()).counts.found, 0);
    assert.equal(calls.length, 2);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    await cleanupFixture(f);
  }
});
