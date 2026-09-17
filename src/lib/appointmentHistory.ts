import { z } from 'zod';

const agorot = z.number().int().nonnegative().safe();
export const historyCursorSchema = z.object({
  startAt: z.string().datetime(),
  id: z.string().min(1).max(128),
});
export type HistoryCursor = z.infer<typeof historyCursorSchema>;

export const historyAppointmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  staffLabel: z.string(),
  dateLabel: z.string(),
  timeLabel: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'ARRIVED', 'CANCELLED', 'DONE', 'NO_SHOW']),
  bookedPriceAgorot: agorot.nullable(),
  paidAgorot: agorot.nullable(),
});
export type HistoryAppointmentView = z.infer<typeof historyAppointmentSchema>;

export const historyPageSchema = z.object({
  appointments: z.array(historyAppointmentSchema),
  nextCursor: historyCursorSchema.nullable(),
});
export type HistoryPage = z.infer<typeof historyPageSchema>;

export const HISTORY_PAGE_SIZE = 20;
