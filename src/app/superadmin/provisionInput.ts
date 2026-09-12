import { z } from 'zod';
import { BusinessType } from '@prisma/client';
import {
  isValidEmail,
  isValidIsraeliMobile,
  normalizeEmail,
  normalizePhone,
} from '@/lib/crypto';
import { PHONE_OWNER_EMAIL_DOMAIN, ownerEmailForPhone } from '@/lib/ownerPhoneIdentity';

const schema = z
  .object({
    name: z.string().trim().max(120),
    type: z.union([z.nativeEnum(BusinessType), z.literal('')]),
    email: z.string().trim().max(254),
    phone: z.string().trim().max(30),
    importUrl: z.string().trim().max(4096),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'identity' });
    }
    if (
      value.email &&
      (!isValidEmail(value.email) ||
        normalizeEmail(value.email).endsWith(`@${PHONE_OWNER_EMAIL_DOMAIN}`))
    ) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'email' });
    }
    if (
      value.phone &&
      (!/^[+\d\s().-]+$/.test(value.phone) || !isValidIsraeliMobile(value.phone))
    ) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'phone' });
    }
    if (!value.importUrl && !value.name) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'name' });
    }
    if (!value.importUrl && !value.type) {
      ctx.addIssue({ code: 'custom', path: ['type'], message: 'type' });
    }
    if (value.importUrl) {
      try {
        const url = new URL(value.importUrl);
        if (
          (url.protocol !== 'http:' && url.protocol !== 'https:') ||
          url.username ||
          url.password
        ) {
          throw new Error('invalid');
        }
      } catch {
        ctx.addIssue({ code: 'custom', path: ['importUrl'], message: 'url' });
      }
    }
  });

export function parseProvisionInput(formData: FormData) {
  const parsed = schema.safeParse(
    Object.fromEntries(
      ['name', 'type', 'email', 'phone', 'importUrl'].map((key) => [
        key,
        formData.get(key) ?? '',
      ]),
    ),
  );
  if (!parsed.success) return { ok: false as const };
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  const phoneIdentity = phone ? ownerEmailForPhone(phone) : null;
  const email = normalizeEmail(parsed.data.email) || phoneIdentity;
  if (!email) return { ok: false as const };
  return {
    ok: true as const,
    value: {
      name: parsed.data.name || null,
      type: parsed.data.type || null,
      phone,
      ownerEmail: email,
      phoneIdentity,
      importUrl: parsed.data.importUrl || null,
    },
  };
}
