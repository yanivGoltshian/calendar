'use client';

import { useEffect } from 'react';
import SectionHeading from './SectionHeading';

type Props = { title: string; urls: string[]; eyebrow?: string };

declare global {
  interface Window {
    instgrm?: { Embeds?: { process?: () => void } };
  }
}

const EMBED_SRC = 'https://www.instagram.com/embed.js';

// הטמעת פוסטים רשמית של אינסטגרם — לכל קישור blockquote רשמי, וסקריפט ההטמעה
// נטען פעם אחת ומעבד את הבלוקים לאחר עלייה/שינוי. מרונדר ריק כשאין קישורים.
export default function LandingInstagramEmbeds({ title, urls, eyebrow }: Props) {
  useEffect(() => {
    if (urls.length === 0) return;
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${EMBED_SRC}"]`);
    if (existing) {
      window.instgrm?.Embeds?.process?.();
      return;
    }
    const script = document.createElement('script');
    script.src = EMBED_SRC;
    script.async = true;
    script.onload = () => window.instgrm?.Embeds?.process?.();
    document.body.appendChild(script);
  }, [urls]);

  if (urls.length === 0) return null;

  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mx-auto mt-10 grid max-w-[1000px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {urls.map((url) => (
          <blockquote
            key={url}
            className="instagram-media mx-auto w-full"
            data-instgrm-permalink={url}
            data-instgrm-version="14"
            style={{ background: '#fff', border: 0, margin: 0, padding: 0, width: '100%' }}
          />
        ))}
      </div>
    </section>
  );
}
