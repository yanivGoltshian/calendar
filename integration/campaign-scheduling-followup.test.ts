import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { prisma } from '../src/lib/db';
import {
  handleCampaignCron,
  type CampaignCronDeps,
} from '../src/app/api/cron/campaigns/handler';
import {
  createCampaign,
  getDueScheduledCampaigns,
  sendCampaign,
} from '../src/server/repos/marketing';
import { parseCampaignScheduledAt } from '../src/server/campaigns/schedule';
import { deliverEmailOnce } from '../src/server/billing/emailDelivery';
import { bookingFixture, cleanupFixture } from './fixtures';

after(() => prisma.$disconnect());

const input = {
  name: 'Synthetic scheduled followup',
  body: 'Isolated provider mocks only',
  segment: 'all' as const,
  channels: ['email' as const],
};

const noDelivery = {
  deliverEmailOnce: async () => {
    assert.fail('No email provider should be called');
  },
  sendGuardedSms: async () => {
    assert.fail('No SMS provider should be called');
  },
};

test('parsed wall time persists as UTC and the due query preserves tenant and boundary scope', async () => {
  const first = await bookingFixture();
  const second = await bookingFixture();
  try {
    const scheduledAt = parseCampaignScheduledAt('2028-07-15T12:30', 'Asia/Jerusalem');
    assert.ok(scheduledAt);
    const scheduled = await createCampaign(first.business.id, { ...input, scheduledAt });
    const future = await createCampaign(first.business.id, {
      ...input,
      scheduledAt: new Date(scheduledAt.getTime() + 60_000),
    });
    const otherTenant = await createCampaign(second.business.id, {
      ...input,
      scheduledAt,
    });
    const draft = await createCampaign(first.business.id, input);

    assert.equal(scheduled.scheduledAt?.toISOString(), '2028-07-15T09:30:00.000Z');
    const before = await getDueScheduledCampaigns(new Date(scheduledAt.getTime() - 1));
    assert.ok(!before.some((row) => row.id === scheduled.id || row.id === otherTenant.id));
    const due = await getDueScheduledCampaigns(scheduledAt);
    assert.deepEqual(
      due.filter((row) => row.businessId === first.business.id).map((row) => row.id),
      [scheduled.id],
    );
    assert.ok(due.some((row) => row.id === otherTenant.id));
    assert.ok(!due.some((row) => row.id === future.id || row.id === draft.id));

    assert.deepEqual(
      await sendCampaign(second.business.id, scheduled.id, noDelivery),
      { ok: false, reason: 'not_found' },
    );
    assert.equal(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: scheduled.id } })).status,
      'SCHEDULED',
    );
    assert.equal(await prisma.messageLog.count({ where: { campaignId: scheduled.id } }), 0);
  } finally {
    await cleanupFixture(first);
    await cleanupFixture(second);
  }
});

test('concurrent permanent rejections leave the bounded queue and allow later due work to progress', async () => {
  const f = await bookingFixture();
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'isolated-campaign-followup';
  try {
    await prisma.client.update({
      where: { id: f.client.id },
      data: { email: 'synthetic@example.invalid', phone: '+972500000001' },
    });
    const blockedSms = await createCampaign(f.business.id, {
      ...input,
      channels: ['sms'],
      scheduledAt: new Date(Date.now() - 60_000),
    });
    const noAudience = await createCampaign(f.business.id, {
      ...input,
      segment: 'with_appointments',
      scheduledAt: new Date(Date.now() - 50_000),
    });
    const deliverable = await createCampaign(f.business.id, {
      ...input,
      scheduledAt: new Date(Date.now() - 40_000),
    });
    let emailCalls = 0;
    const deps: CampaignCronDeps = {
      getDueScheduledCampaigns: (now) => getDueScheduledCampaigns(now, 2),
      sendCampaign: (businessId, id) => {
        assert.equal(businessId, f.business.id);
        return sendCampaign(businessId, id, {
          deliverEmailOnce: (request) => deliverEmailOnce(request, {
            configured: true,
            send: async () => {
              emailCalls += 1;
            },
          }),
          sendGuardedSms: async () => {
            assert.fail('Entitlement-filtered SMS must not reach the paid delivery guard');
          },
        });
      },
    };
    const request = () => new Request('http://localhost/api/cron/campaigns', {
      method: 'POST',
      headers: { 'x-cron-secret': 'isolated-campaign-followup' },
    });

    await Promise.all([
      handleCampaignCron(request(), deps),
      handleCampaignCron(request(), deps),
    ]);
    await handleCampaignCron(request(), deps);

    assert.equal(emailCalls, 1);
    for (const campaign of [blockedSms, noAudience]) {
      assert.equal(
        (await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status,
        'FAILED',
      );
      const logs = await prisma.messageLog.findMany({ where: { campaignId: campaign.id } });
      assert.equal(logs.length, 1);
      assert.equal(logs[0].status, 'BLOCKED');
      assert.equal(logs[0].error, 'no_recipients');
      assert.equal(logs[0].countsToCap, false);
    }
    assert.equal(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: deliverable.id } })).status,
      'SENT',
    );
    assert.equal((await (await handleCampaignCron(request(), deps)).json()).counts.found, 0);
    assert.equal(emailCalls, 1);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    await cleanupFixture(f);
  }
});

test('scheduled inactive campaigns reject once while manual drafts remain retryable', async () => {
  const f = await bookingFixture();
  try {
    const draft = await createCampaign(f.business.id, input);
    assert.deepEqual(await sendCampaign(f.business.id, draft.id, noDelivery), {
      ok: false,
      reason: 'no_recipients',
    });
    assert.equal(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: draft.id } })).status,
      'DRAFT',
    );
    assert.equal(await prisma.messageLog.count({ where: { campaignId: draft.id } }), 0);

    await prisma.business.update({
      where: { id: f.business.id },
      data: { paidUntil: new Date(Date.now() - 60_000) },
    });
    assert.deepEqual(await sendCampaign(f.business.id, draft.id, noDelivery), {
      ok: false,
      reason: 'business_inactive',
    });
    assert.equal(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: draft.id } })).status,
      'DRAFT',
    );

    const scheduled = await createCampaign(f.business.id, {
      ...input,
      scheduledAt: new Date(Date.now() - 30_000),
    });
    const results = await Promise.all([
      sendCampaign(f.business.id, scheduled.id, noDelivery),
      sendCampaign(f.business.id, scheduled.id, noDelivery),
    ]);
    assert.equal(
      results.filter((result) => !result.ok && result.reason === 'business_inactive').length,
      1,
    );
    assert.equal(
      results.filter((result) => !result.ok && result.reason === 'already_sent').length,
      1,
    );
    assert.equal(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: scheduled.id } })).status,
      'FAILED',
    );
    assert.equal(
      await prisma.messageLog.count({
        where: { campaignId: scheduled.id, error: 'business_inactive' },
      }),
      1,
    );
    assert.ok(!(await getDueScheduledCampaigns(new Date())).some(
      (row) => row.businessId === f.business.id,
    ));
  } finally {
    await cleanupFixture(f);
  }
});

test('already claimed or completed campaigns are never downgraded by rejection handling', async () => {
  const f = await bookingFixture();
  try {
    await prisma.business.update({
      where: { id: f.business.id },
      data: { paidUntil: new Date(Date.now() - 60_000) },
    });
    const sending = await createCampaign(f.business.id, {
      ...input,
      scheduledAt: new Date(Date.now() - 60_000),
    });
    const sent = await createCampaign(f.business.id, {
      ...input,
      scheduledAt: new Date(Date.now() - 30_000),
    });
    await prisma.campaign.update({
      where: { id: sending.id },
      data: { status: 'SENDING' },
    });
    await prisma.campaign.update({
      where: { id: sent.id },
      data: { status: 'SENT' },
    });

    for (const campaign of [sending, sent]) {
      assert.deepEqual(await sendCampaign(f.business.id, campaign.id, noDelivery), {
        ok: false,
        reason: 'already_sent',
      });
      assert.equal(
        (await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status,
        campaign.id === sending.id ? 'SENDING' : 'SENT',
      );
      assert.equal(await prisma.messageLog.count({ where: { campaignId: campaign.id } }), 0);
    }
  } finally {
    await cleanupFixture(f);
  }
});
