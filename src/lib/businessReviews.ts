import { z } from 'zod';

export const REVIEW_TEXT_LIMIT = 240;
export const REVIEW_NAME_LIMIT = 40;

const numericField = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export const reviewInputSchema = z.object({
  name: z.string().trim().min(1).max(REVIEW_NAME_LIMIT),
  rating: z.preprocess(numericField, z.number().int().min(1).max(5)),
  text: z.string().trim().max(REVIEW_TEXT_LIMIT),
});

export const manualReviewSchema = reviewInputSchema.extend({
  requestKey: z.string().uuid(),
  status: z.enum(['PENDING', 'PUBLISHED']),
});

export const reviewEditSchema = z.object({
  id: z.string().min(1).max(100),
  version: z.preprocess(numericField, z.number().int().nonnegative()),
  rating: reviewInputSchema.shape.rating,
  text: reviewInputSchema.shape.text,
  status: z.enum(['PENDING', 'PUBLISHED', 'HIDDEN']),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type ReviewStatus = z.infer<typeof reviewEditSchema>['status'];
export type ReviewErrorCode =
  | 'unauthorized'
  | 'invalid'
  | 'ineligible'
  | 'already_submitted'
  | 'not_found'
  | 'conflict'
  | 'rating_locked'
  | 'save_failed';

export type ReviewActionState = {
  ok: boolean;
  error?: ReviewErrorCode;
  id?: string;
};

export type PublicBusinessReview = {
  id: string;
  name: string;
  rating: number;
  quote: string;
  editedByBusiness: boolean;
  originalQuote?: string;
};

export type AdminBusinessReview = {
  id: string;
  name: string;
  rating: number;
  originalText: string;
  text: string;
  origin: 'CUSTOMER' | 'OWNER';
  status: ReviewStatus;
  version: number;
  createdAt: string;
};

export const reviewSubmissionContextSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('guest') }),
  z.object({
    mode: z.literal('customer'),
    name: z.string(),
    appointments: z.array(z.object({ id: z.string(), label: z.string() })),
    submitted: z.array(z.object({ id: z.string(), status: z.enum(['PENDING', 'PUBLISHED', 'HIDDEN']) })),
  }),
]);

export type ReviewSubmissionContext = z.infer<typeof reviewSubmissionContextSchema>;

export class BusinessReviewError extends Error {
  constructor(public readonly code: ReviewErrorCode) {
    super(code);
    this.name = 'BusinessReviewError';
  }
}
