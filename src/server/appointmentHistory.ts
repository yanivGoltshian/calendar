import type { Prisma } from '@prisma/client';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';
import type { HistoryAppointmentView } from '@/lib/appointmentHistory';
import { t } from '@/i18n';

export const historyAppointmentSelect = {
  id: true,
  businessId: true,
  clientId: true,
  startAt: true,
  status: true,
  totalPriceAgorot: true,
  staff: { select: { displayName: true } },
  services: { select: { serviceId: true, nameSnapshot: true } },
  sales: {
    take: 2,
    select: {
      businessId: true,
      clientId: true,
      appointmentId: true,
      status: true,
      subtotalAgorot: true,
      discountAgorot: true,
      totalAgorot: true,
      paidAgorot: true,
      items: {
        select: {
          kind: true,
          serviceId: true,
          quantity: true,
          unitPriceAgorot: true,
          lineTotalAgorot: true,
        },
      },
      payments: { select: { amountAgorot: true } },
      documents: {
        where: {
          OR: [{ type: 'CREDIT_NOTE' }, { credits: { some: { type: 'CREDIT_NOTE' } } }],
        },
        take: 1,
        select: { id: true },
      },
    },
  },
} satisfies Prisma.AppointmentSelect;

export type HistoricalAppointment = Prisma.AppointmentGetPayload<{
  select: typeof historyAppointmentSelect;
}>;

const validMoney = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** A sale total is attributable only to an exactly matching, settled service-only basket. */
export function recordedAppointmentPayment(
  appointment: HistoricalAppointment,
): number | null {
  if (appointment.status !== 'DONE' || appointment.sales.length !== 1) return null;
  const sale = appointment.sales[0];
  if (
    sale.businessId !== appointment.businessId ||
    sale.clientId !== appointment.clientId ||
    sale.appointmentId !== appointment.id ||
    sale.status !== 'COMPLETED' ||
    sale.documents.length > 0 ||
    sale.payments.length === 0 ||
    appointment.services.length === 0 ||
    sale.items.length !== appointment.services.length
  )
    return null;

  const services = new Set(appointment.services.map((service) => service.serviceId));
  if (services.size !== appointment.services.length) return null;
  for (const item of sale.items) {
    if (
      item.kind !== 'SERVICE' ||
      !item.serviceId ||
      !services.delete(item.serviceId) ||
      item.quantity !== 1 ||
      !validMoney(item.unitPriceAgorot) ||
      item.lineTotalAgorot !== item.unitPriceAgorot
    )
      return null;
  }
  if (
    services.size > 0 ||
    !sale.payments.every((p) => validMoney(p.amountAgorot) && p.amountAgorot > 0)
  )
    return null;

  const subtotal = sale.items.reduce((sum, item) => sum + item.lineTotalAgorot, 0);
  const paid = sale.payments.reduce((sum, payment) => sum + payment.amountAgorot, 0);
  if (
    ![subtotal, paid, sale.discountAgorot, sale.totalAgorot, sale.paidAgorot].every(
      validMoney,
    ) ||
    subtotal !== sale.subtotalAgorot ||
    sale.discountAgorot > subtotal ||
    subtotal - sale.discountAgorot !== sale.totalAgorot ||
    paid !== sale.totalAgorot ||
    paid !== sale.paidAgorot
  )
    return null;
  return paid;
}

export function historyAppointmentView(
  appointment: HistoricalAppointment,
  business: { name: string; timezone: string },
): HistoryAppointmentView {
  return {
    id: appointment.id,
    title:
      appointment.services
        .map((service) => service.nameSnapshot)
        .filter(Boolean)
        .join(' + ') || business.name,
    staffLabel: appointment.staff.displayName
      ? `${t.premiumLanding.clinic.returning.withStaff} ${appointment.staff.displayName}`
      : '',
    dateLabel: formatLongDate(
      formatDateString(appointment.startAt, business.timezone),
      business.timezone,
    ),
    timeLabel: formatTime(appointment.startAt, business.timezone),
    status: appointment.status,
    // Legacy zero defaults and hidden-price bookings do not prove a recorded price.
    bookedPriceAgorot:
      validMoney(appointment.totalPriceAgorot) && appointment.totalPriceAgorot > 0
        ? appointment.totalPriceAgorot
        : null,
    paidAgorot: recordedAppointmentPayment(appointment),
  };
}
