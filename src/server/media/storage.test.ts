import assert from 'node:assert/strict';
import test from 'node:test';
import { publishedMediaKeysForBusiness } from './storage';

test('published media quota keys include only media still referenced by the same business', () => {
  const keys = publishedMediaKeysForBusiness('biz-1', {
    logoUrl: 'https://storage.example.invalid/hero-videos/media/biz-1/logo.webp',
    coverImageUrl: '/media/biz-1/cover.webp',
    landingContent: {
      heroVideoUrl: 'https://storage.example.invalid/media/biz-1/current-video.mp4',
      heroImages: [
        'https://storage.example.invalid/media/biz-1/gallery.webp',
        'https://storage.example.invalid/media/other-business/foreign.webp',
        'https://external.example.invalid/not-owned.jpg',
      ],
      galleryImageUrls: ['/media/biz-1/gallery-2.webp'],
      beforeAfter: [
        {
          beforeUrl: '/media/biz-1/before.webp',
          afterUrl: '/media/biz-1/after.webp',
          label: 'לפני ואחרי',
        },
      ],
      hotDeals: { images: ['/media/biz-1/deal.webp'] },
    },
  });

  assert.deepEqual([...keys].sort(), [
    'media/biz-1/after.webp',
    'media/biz-1/before.webp',
    'media/biz-1/cover.webp',
    'media/biz-1/current-video.mp4',
    'media/biz-1/deal.webp',
    'media/biz-1/gallery-2.webp',
    'media/biz-1/gallery.webp',
    'media/biz-1/logo.webp',
  ]);
});

test('removed media is absent from quota keys once it is no longer referenced in published content', () => {
  const keys = publishedMediaKeysForBusiness('biz-1', {
    landingContent: {
      heroVideoUrl: null,
      heroImages: [],
      note: 'https://storage.example.invalid/media/biz-1/removed-video.mp4',
    },
  });

  assert.deepEqual([...keys], []);
  assert.deepEqual([...publishedMediaKeysForBusiness('biz-1', { landingContent: {} })], []);
});
