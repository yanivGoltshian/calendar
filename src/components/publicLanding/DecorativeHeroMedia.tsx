'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { imageUrl } from '@/lib/media';
import { heroVideoResolve } from '@/lib/videoEmbed';
import MediaImage from './MediaImage';

type Connection = EventTarget & { saveData?: boolean };

export default function DecorativeHeroMedia({
  url,
  poster,
  className,
  feather = false,
}: {
  url: string;
  poster?: string;
  className: string;
  feather?: boolean;
}) {
  const media = heroVideoResolve(url);
  const source = media?.src;
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [automatic, setAutomatic] = useState(false);
  const [visible, setVisible] = useState(false);
  const [choice, setChoice] = useState<'play' | 'pause' | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const shouldPlay =
    visible &&
    !blocked &&
    !failed &&
    (choice === 'play' || (choice === null && automatic));

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    const update = () => setAutomatic(!motion.matches && !connection?.saveData);
    update();
    motion.addEventListener('change', update);
    connection?.addEventListener('change', update);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (frame.current) observer.observe(frame.current);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', update);
      connection?.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    setChoice(null);
    setBlocked(false);
    setFailed(false);
    setLoadedUrl(null);
  }, [url]);

  useEffect(() => {
    const element = video.current;
    if (!element || !source) return;
    let current = true;
    if (shouldPlay) {
      setLoadedUrl(source);
      // Keep muted playback explicit for mobile browsers, including restored tabs.
      element.muted = true;
      void element.play().catch((error: unknown) => {
        if (current && !(error instanceof DOMException && error.name === 'AbortError')) {
          setBlocked(true);
        }
      });
    } else {
      element.pause();
    }
    return () => {
      current = false;
    };
  }, [shouldPlay, source]);

  if (!media) return null;
  const active = media.kind === 'embed' ? shouldPlay : playing;
  return (
    <>
      <div ref={frame} className={className} data-hero-media>
        {poster ? (
          <MediaImage
            src={poster}
            alt=""
            sizes="46vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {media.kind === 'file' ? (
          <video
            ref={video}
            src={shouldPlay || loadedUrl === media.src ? media.src : undefined}
            autoPlay={shouldPlay}
            muted
            loop
            playsInline
            preload="none"
            poster={poster ? imageUrl(poster, 960) : undefined}
            aria-hidden
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => {
              setFailed(true);
              setPlaying(false);
            }}
            className={`absolute inset-0 h-full w-full object-cover ${failed ? 'invisible' : ''}`}
          />
        ) : shouldPlay ? (
          <iframe
            src={media.src}
            className="pointer-events-none absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            title={t.premiumLanding.heroMedia.title}
            aria-hidden
            tabIndex={-1}
          />
        ) : null}
        {feather ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-24"
            style={{
              background: 'linear-gradient(to left, rgba(44,37,34,0.72), transparent)',
            }}
          />
        ) : null}
      </div>
      <button
        type="button"
        style={{ position: 'absolute' }}
        className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-3 py-2 text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        aria-label={
          active ? t.premiumLanding.heroMedia.pause : t.premiumLanding.heroMedia.play
        }
        aria-pressed={active}
        onClick={(event) => {
          event.stopPropagation();
          if (failed) video.current?.load();
          setBlocked(false);
          setFailed(false);
          setChoice(active ? 'pause' : 'play');
        }}
      >
        <span aria-hidden>{active ? 'Ⅱ' : '▶'}</span>
      </button>
      {failed ? (
        <span role="status" className="sr-only">
          {t.premiumLanding.heroMedia.unavailable}
        </span>
      ) : null}
    </>
  );
}
