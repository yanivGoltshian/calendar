import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isDirectVideoUrl,
  isSupportedSocialVideoUrl,
  normalizeInstagramPostUrl,
} from './publicMediaUrl';

test('direct video URLs are identified from the URL path', () => {
  assert.equal(isDirectVideoUrl('https://cdn.example.com/video.mp4?version=2'), true);
  assert.equal(isDirectVideoUrl('https://example.com/watch?file=video.mp4'), false);
  assert.equal(isDirectVideoUrl('javascript:alert(1)'), false);
});

test('social video URLs require a supported provider host and shape', () => {
  assert.equal(isSupportedSocialVideoUrl('https://youtube.com/watch?v=abc'), true);
  assert.equal(isSupportedSocialVideoUrl('https://youtu.be/abc'), true);
  assert.equal(
    isSupportedSocialVideoUrl('https://www.tiktok.com/@owner/video/123'),
    true,
  );
  assert.equal(isSupportedSocialVideoUrl('https://vimeo.com/123456'), true);
  assert.equal(isSupportedSocialVideoUrl('https://evil-youtube.com/watch?v=abc'), false);
  assert.equal(isSupportedSocialVideoUrl('https://example.com/video/123'), false);
});

test('Instagram post URLs reject lookalike hosts and unrelated profile paths', () => {
  assert.equal(
    normalizeInstagramPostUrl('/p/ABC123/', 'https://www.instagram.com/acme/'),
    'https://www.instagram.com/p/ABC123/',
  );
  assert.equal(
    normalizeInstagramPostUrl('/p/ABC123/', 'https://www.instagram.com/acme/', 'acme'),
    null,
  );
  assert.equal(
    normalizeInstagramPostUrl(
      '/acme/reel/ABC123/?utm_source=test',
      'https://www.instagram.com/acme/',
      'acme',
    ),
    'https://www.instagram.com/acme/reel/ABC123/',
  );
  assert.equal(
    normalizeInstagramPostUrl(
      'https://www.instagram.com/other/p/ABC123/',
      undefined,
      'acme',
    ),
    null,
  );
  assert.equal(
    normalizeInstagramPostUrl('https://evilinstagram.com/acme/p/ABC123/'),
    null,
  );
});
