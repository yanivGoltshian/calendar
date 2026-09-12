import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessIconUrl } from './businessIcons';

test('business icons change cache identity when branding changes while keeping logo data out of metadata', () => {
  const business = { slug: 'fixture', name: 'Fixture', logoUrl: null, brandColor: '#112233' };
  const original = businessIconUrl(business);
  assert.equal(businessIconUrl({ ...business }), original);
  for (const change of [{ name: 'Renamed' }, { logoUrl: '/new.png' }, { brandColor: '#334455' }]) {
    assert.notEqual(businessIconUrl({ ...business, ...change }), original);
  }
  const embedded = businessIconUrl({ ...business, logoUrl: `data:image/png;base64,${'a'.repeat(100_000)}` });
  assert.ok(embedded.length < 100);
  assert.ok(!embedded.includes('data:'));
  assert.match(businessIconUrl(business, 512, true), /size=512&v=[a-f0-9]{16}&maskable=1$/);
});
