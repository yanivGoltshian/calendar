'use client';

import { useEffect } from 'react';
import SectionHeading from './SectionHeading';
import { socialVideoResolve, type SocialVideo } from '@/lib/videoEmbed';

type Props = { title: string; urls: string[]; eyebrow?: string };

const TIKTOK_SRC = 'https://www.tiktok.com/embed.js';

// גלריית סרטונים חברתיים — יוטיוב כ-iframe פרטיות, טיקטוק כ-blockquote רשמי
// עם embed.js שנטען פעם אחת. כל קישור נפתר דרך socialVideoResolve. ריק ⇐ לא מרונדר.
export default function LandingSocialVideos({ title, urls, eyebrow }: Props) {
  const resolved = urls
    .map((u) => socialVideoResolve(u))
    .filter((v): v is SocialVideo => v != null);
  const hasTiktok = resolved.some((v) => v.platform === 'tiktok');

  useEffect(() => {
    if (!hasTiktok) return;
    if (document.querySelector<HTMLScriptElement>(`script[src="${TIKTOK_SRC}"]`)) return;
    const script = document.createElement('script');
    script.src = TIKTOK_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, [hasTiktok]);

  if (resolved.length === 0) return null;

  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mx-auto mt-10 grid max-w-[1000px] grid-cols-1 items-start gap-6 sm:grid-cols-2">
        {resolved.map((video, i) => {
          if (video.platform === 'tiktok') {
            return (
              <blockquote
                key={`tt-${i}`}
                className="tiktok-embed mx-auto"
                cite={video.cite}
                {...(video.videoId ? { 'data-video-id': video.videoId } : {})}
                style={{ maxWidth: 605, minWidth: 260, margin: '0 auto' }}
              >
                <section />
              </blockquote>
            );
          }
          return (
            <div
              key={`v-${i}`}
              className="relative aspect-video overflow-hidden rounded-2xl border border-[color:var(--biz-border)] bg-black shadow-soft"
            >
              <iframe
                src={video.src}
                title={title}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
                style={{ border: 0 }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
