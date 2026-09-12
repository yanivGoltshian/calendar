export type SocialKind = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';

export function hasFollowLinks(links: Partial<Record<SocialKind, string>> | null | undefined): boolean {
  return Boolean(links?.instagram?.trim() || links?.facebook?.trim() || links?.tiktok?.trim());
}

// בונה קישור מלא מתוך ערך שהוזן (מספר טלפון, שם משתמש או כתובת מלאה) עבור כל רשת חברתית.
// אם הוזנה כתובת מלאה (http/https) היא מוחזרת כפי שהיא. אחרת נבנה קישור סטנדרטי לפי סוג הרשת.
export function socialHref(kind: SocialKind, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '');
  switch (kind) {
    case 'whatsapp': {
      const digits = v.replace(/[^\d]/g, '');
      const number = /^0[1-9]\d{7,8}$/.test(digits) ? normalizePhone(digits).slice(1) : digits;
      return `https://wa.me/${number}`;
    }
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
  }
}
import { normalizePhone } from './phone';
