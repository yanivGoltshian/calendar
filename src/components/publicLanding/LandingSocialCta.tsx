import Link from 'next/link';
import { ArrowLeftIcon, WhatsappIcon, InstagramIcon, FacebookIcon, TiktokIcon } from './icons';

type SocialLinks = { whatsapp?: string; instagram?: string; facebook?: string; tiktok?: string };

type Props = {
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  bookHref: string;
  socialTitle: string;
  socialLinks: SocialLinks;
  labels: { whatsapp: string; instagram: string; facebook: string; tiktok: string };
};

function toHref(kind: keyof SocialLinks, value: string): string {
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

// מקטע סיום — קריאה לפעולה לקביעת תור לצד כפתורי רשתות חברתיות.
export default function LandingSocialCta({ ctaTitle, ctaText, ctaLabel, bookHref, socialTitle, socialLinks, labels }: Props) {
  const socials = [
    { kind: 'whatsapp' as const, label: labels.whatsapp, icon: WhatsappIcon },
    { kind: 'instagram' as const, label: labels.instagram, icon: InstagramIcon },
    { kind: 'facebook' as const, label: labels.facebook, icon: FacebookIcon },
    { kind: 'tiktok' as const, label: labels.tiktok, icon: TiktokIcon },
  ].filter((s) => Boolean(socialLinks[s.kind]));

  return (
    <section className="mt-12 overflow-hidden rounded-3xl border border-[color:var(--biz-border)] bg-[var(--biz-soft)] px-5 py-9 text-center shadow-sm sm:px-8">
      <h2 className="text-2xl font-bold text-slate-900">{ctaTitle}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{ctaText}</p>
      <Link
        href={bookHref}
        className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--biz)] px-8 py-3.5 text-base font-bold text-[color:var(--biz-ink)] shadow-md transition hover:bg-[var(--biz-strong)]"
      >
        {ctaLabel}
        <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
      </Link>

      {socials.length > 0 ? (
        <div className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{socialTitle}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            {socials.map(({ kind, label, icon: Icon }) => (
              <a
                key={kind}
                href={toHref(kind, socialLinks[kind] as string)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--biz-border)] bg-white text-[color:var(--biz-strong)] shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--biz)] hover:text-[color:var(--biz-ink)]"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
