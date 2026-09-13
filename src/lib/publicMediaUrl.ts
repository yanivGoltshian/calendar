function hostnameMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function parseHttpUrl(value: string, baseUrl?: string): URL | null {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function normalizeHttpUrl(value: string): string | null {
  return parseHttpUrl(value) ? value.trim() : null;
}

export function isUrlForDomain(value: string, domain: string): boolean {
  const url = parseHttpUrl(value);
  return Boolean(
    url && hostnameMatches(url.hostname.toLowerCase().replace(/^www\.|^m\./, ''), domain),
  );
}

export function isDirectVideoUrl(value: string): boolean {
  const url = parseHttpUrl(value);
  return Boolean(url && /\.(?:mp4|webm|mov|m4v)$/i.test(url.pathname));
}

export function isSupportedSocialVideoUrl(value: string): boolean {
  const url = parseHttpUrl(value);
  if (!url) return false;
  const hostname = url.hostname.toLowerCase().replace(/^www\.|^m\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  if (hostnameMatches(hostname, 'youtube.com')) {
    return (
      (url.pathname === '/watch' && Boolean(url.searchParams.get('v'))) ||
      (['embed', 'shorts', 'live'].includes(segments[0] ?? '') && Boolean(segments[1]))
    );
  }
  if (hostname === 'youtu.be') return Boolean(segments[0]);
  if (hostnameMatches(hostname, 'vimeo.com')) {
    return (
      (hostname === 'player.vimeo.com' &&
        segments[0] === 'video' &&
        /^\d+$/.test(segments[1] ?? '')) ||
      /^\d+$/.test(segments[0] ?? '')
    );
  }
  if (hostnameMatches(hostname, 'tiktok.com')) {
    return segments.includes('video') && Boolean(segments.at(-1));
  }
  if (hostnameMatches(hostname, 'instagram.com')) {
    return (
      (['reel', 'reels'].includes(segments[0] ?? '') && Boolean(segments[1])) ||
      (['reel', 'reels'].includes(segments[1] ?? '') && Boolean(segments[2]))
    );
  }
  return false;
}

export function normalizeInstagramPostUrl(
  value: string,
  baseUrl?: string,
  expectedProfile?: string,
): string | null {
  const url = parseHttpUrl(value, baseUrl);
  if (!url) return null;
  const hostname = url.hostname.toLowerCase().replace(/^www\.|^m\./, '');
  if (hostname !== 'instagram.com') return null;

  const segments = url.pathname.split('/').filter(Boolean);
  const standardPost =
    !expectedProfile && ['p', 'reel'].includes(segments[0] ?? '') && Boolean(segments[1]);
  const profilePost =
    ['p', 'reel'].includes(segments[1] ?? '') &&
    Boolean(segments[2]) &&
    (!expectedProfile || segments[0]?.toLowerCase() === expectedProfile.toLowerCase());
  if (!standardPost && !profilePost) return null;

  url.hash = '';
  url.search = '';
  return url.href;
}
