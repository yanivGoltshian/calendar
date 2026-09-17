import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  historyAppointmentView,
  recordedAppointmentPayment,
  type HistoricalAppointment,
} from './appointmentHistory';
import { historyCursorSchema } from '@/lib/appointmentHistory';

function fixture(): HistoricalAppointment {
  return {
    id: 'appointment',
    businessId: 'business',
    clientId: 'client',
    startAt: new Date('2026-09-03T13:30:00Z'),
    status: 'DONE',
    totalPriceAgorot: 25000,
    staff: { displayName: 'Synthetic staff' },
    services: [{ serviceId: 'service', nameSnapshot: 'Historical service' }],
    sales: [
      {
        businessId: 'business',
        clientId: 'client',
        appointmentId: 'appointment',
        status: 'COMPLETED',
        subtotalAgorot: 25000,
        discountAgorot: 3000,
        totalAgorot: 22000,
        paidAgorot: 22000,
        items: [
          {
            kind: 'SERVICE',
            serviceId: 'service',
            quantity: 1,
            unitPriceAgorot: 25000,
            lineTotalAgorot: 25000,
          },
        ],
        payments: [{ amountAgorot: 12000 }, { amountAgorot: 10000 }],
        documents: [],
      },
    ],
  };
}

test('history retains booked snapshots, business-local time and independently recorded payment', () => {
  const view = historyAppointmentView(fixture(), {
    name: 'Business',
    timezone: 'Asia/Jerusalem',
  });
  assert.equal(view.title, 'Historical service');
  assert.equal(view.timeLabel, '16:30');
  assert.equal(view.bookedPriceAgorot, 25000);
  assert.equal(view.paidAgorot, 22000);
  assert.equal(view.status, 'DONE');
  assert.deepEqual(
    Object.keys(view).sort(),
    [
      'id',
      'title',
      'staffLabel',
      'dateLabel',
      'timeLabel',
      'status',
      'bookedPriceAgorot',
      'paidAgorot',
    ].sort(),
  );
});

const unavailable: [string, (appointment: HistoricalAppointment) => void][] = [
  [
    'missing sale',
    (a) => {
      a.sales = [];
    },
  ],
  [
    'multiple sales',
    (a) => {
      a.sales.push(structuredClone(a.sales[0]));
    },
  ],
  [
    'cross-business sale',
    (a) => {
      a.sales[0].businessId = 'other';
    },
  ],
  [
    'cross-client sale',
    (a) => {
      a.sales[0].clientId = 'other';
    },
  ],
  [
    'unlinked client',
    (a) => {
      a.sales[0].clientId = null;
    },
  ],
  [
    'wrong appointment',
    (a) => {
      a.sales[0].appointmentId = 'other';
    },
  ],
  [
    'open sale',
    (a) => {
      a.sales[0].status = 'OPEN';
    },
  ],
  [
    'voided sale',
    (a) => {
      a.sales[0].status = 'VOIDED';
    },
  ],
  [
    'refunded sale',
    (a) => {
      a.sales[0].status = 'REFUNDED';
    },
  ],
  [
    'credit note',
    (a) => {
      a.sales[0].documents = [{ id: 'credit' }];
    },
  ],
  [
    'completed sale without payments',
    (a) => {
      a.sales[0].payments = [];
    },
  ],
  [
    'partial payment',
    (a) => {
      a.sales[0].payments.pop();
      a.sales[0].paidAgorot = 12000;
    },
  ],
  [
    'stale paid aggregate',
    (a) => {
      a.sales[0].paidAgorot = 25000;
    },
  ],
  [
    'negative payment',
    (a) => {
      a.sales[0].payments[0].amountAgorot = -12000;
    },
  ],
  [
    'product basket',
    (a) => {
      a.sales[0].items[0].kind = 'PRODUCT';
    },
  ],
  [
    'custom item',
    (a) => {
      a.sales[0].items[0].kind = 'CUSTOM';
    },
  ],
  [
    'extra item',
    (a) => {
      a.sales[0].items.push(structuredClone(a.sales[0].items[0]));
    },
  ],
  [
    'different service',
    (a) => {
      a.sales[0].items[0].serviceId = 'other';
    },
  ],
  [
    'multiple quantities',
    (a) => {
      a.sales[0].items[0].quantity = 2;
    },
  ],
  [
    'inconsistent item total',
    (a) => {
      a.sales[0].items[0].lineTotalAgorot = 1;
    },
  ],
  [
    'inconsistent discount',
    (a) => {
      a.sales[0].discountAgorot = 0;
    },
  ],
  [
    'cancelled appointment',
    (a) => {
      a.status = 'CANCELLED';
    },
  ],
  [
    'past confirmed appointment',
    (a) => {
      a.status = 'CONFIRMED';
    },
  ],
  [
    'missing booked services',
    (a) => {
      a.services = [];
    },
  ],
];
for (const [name, mutate] of unavailable) {
  test(`${name} does not manufacture an appointment payment`, () => {
    const appointment = fixture();
    mutate(appointment);
    assert.equal(recordedAppointmentPayment(appointment), null);
  });
}

test('zero/default or corrupt booked totals remain unavailable, independent of actual payment', () => {
  for (const total of [0, -1, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const appointment = fixture();
    appointment.totalPriceAgorot = total;
    const view = historyAppointmentView(appointment, {
      name: 'Business',
      timezone: 'UTC',
    });
    assert.equal(view.bookedPriceAgorot, null);
    assert.equal(view.paidAgorot, 22000);
  }
});

test('cursor rejects malformed dates and unbounded identifiers', () => {
  assert.ok(
    historyCursorSchema.safeParse({ startAt: '2026-09-03T13:30:00.000Z', id: 'a' })
      .success,
  );
  for (const cursor of [
    { startAt: 'yesterday', id: 'a' },
    { startAt: null, id: 'a' },
    { startAt: '2026-09-03T13:30:00Z', id: 'x'.repeat(129) },
  ]) {
    assert.equal(historyCursorSchema.safeParse(cursor).success, false);
  }
});
