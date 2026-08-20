export type SocialKind = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';

// בונה קישור מלא מתוך ערך שהוזן (מספר טלפון, שם משתמש או כתובת מלאה) עבור כל רשת חברתית.
// אם הוזנה כתובת מלאה (http/https) היא מוחזרת כפי שהיא. אחרת נבנה קישור סטנדרטי לפי סוג הרשת.
export function socialHref(kind: SocialKind, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '');
  switch (kind) {
    case 'whatsapp':
      return `https://wa.me/${v.replace(/[^\d]/g, '')}`;
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
  }
}
