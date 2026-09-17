import { z } from 'zod';
import type { listServicesWithUsage } from '@/server/repos/services';

export const adminServiceSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  durationMin: z.number().int().positive().safe(),
  priceAgorot: z.number().int().nonnegative().safe(),
  hidePrice: z.boolean(),
  hideDuration: z.boolean(),
  hidden: z.boolean(),
  staff: z.array(z.object({
    id: z.string().min(1),
    displayName: z.string(),
    active: z.boolean(),
  }).strict()),
  inUse: z.boolean(),
  updatedAt: z.string().datetime(),
}).strict();

export type AdminServiceSnapshot = z.infer<typeof adminServiceSnapshotSchema>;

export function toAdminServiceSnapshot(
  service: Awaited<ReturnType<typeof listServicesWithUsage>>[number],
): AdminServiceSnapshot {
  return {
    id: service.id,
    name: service.name,
    description: service.description ?? '',
    durationMin: service.durationMin,
    priceAgorot: service.priceAgorot,
    hidePrice: service.hidePrice,
    hideDuration: service.hideDuration,
    hidden: service.hidden,
    staff: service.staffLinks.map(link => link.staff),
    inUse: service._count.appointmentServices > 0,
    updatedAt: service.updatedAt.toISOString(),
  };
}

export function newerServiceSnapshot(
  server: AdminServiceSnapshot,
  confirmed: AdminServiceSnapshot | null,
): AdminServiceSnapshot {
  return confirmed?.id === server.id &&
    Date.parse(confirmed.updatedAt) > Date.parse(server.updatedAt)
    ? confirmed
    : server;
}
