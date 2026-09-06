import type { ImgHTMLAttributes } from 'react';
import { imageUrl, IMAGE_WIDTHS } from '@/lib/media';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  src: string;
  alt: string;
  priority?: boolean;
};

export default function MediaImage({
  src,
  alt = '',
  priority = false,
  sizes = '(max-width: 640px) 100vw, 50vw',
  ...props
}: Props) {
  return (
    // All variants use the bounded, allowlisted image pipeline, not unrestricted next/image fetches.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={alt}
      src={imageUrl(src)}
      srcSet={IMAGE_WIDTHS.map((w) => `${imageUrl(src, w)} ${w}w`).join(', ')}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  );
}
