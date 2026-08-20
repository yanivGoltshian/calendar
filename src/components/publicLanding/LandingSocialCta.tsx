import Link from 'next/link';
import { socialHref } from '@/lib/socialLinks';
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

// מקטע סיום — קריאה לפעולה לקביעת תור לצד כפתורי רשתות חברתיות.
export default function LandingSocialCta({ ctaTitle, ctaText, ctaLabel, bookHref, socialTitle, socialLinks, labels }: Props) {
  const socials = [
    { kind: 'whatsapp' as const, label: labels.whatsapp, icon: WhatsappIcon },
    { kind: 'instagram' as const, label: labels.instagram, icon: InstagramIcon },
    { kind: 'facebook' as const, label: labels.facebook, icon: FacebookIcon },
    { kind: 'tiktok' as const, label: labels.tiktok, icon: TiktokIcon },
  ].filter((s) => Boolean(socialLinks[s.kind]));

  return (
    <section className="mt-16 overflow-hidden rounded-[2.5rem] border border-[color:var(--biz-border)] bg-gradient-to-b from-[var(--biz-soft)] to-[var(--biz-softer)] px-6 py-12 text-center shadow-soft sm:mt-24 sm:px-10 sm:py-16">
      <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">{ctaTitle}</h2>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-slate-600 sm:text-lg">{ctaText}</p>
      <Link
        href={bookHref}
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--biz)] px-9 py-4 text-base font-bold text-[color:var(--biz-ink)] shadow-elevated transition hover:-translate-y-0.5 hover:bg-[var(--biz-strong)]"
      >
        {ctaLabel}
        <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
      </Link>

      {socials.length > 0 ? (
        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{socialTitle}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {socials.map(({ kind, label, icon: Icon }) => (
              <a
                key={kind}
                href={socialHref(kind, socialLinks[kind] as string)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--biz-border)] bg-white text-[color:var(--biz-strong)] shadow-soft transition hover:-translate-y-0.5 hover:bg-[var(--biz)] hover:text-[color:var(--biz-ink)]"
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
