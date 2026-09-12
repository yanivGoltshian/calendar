import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const nextConfig = readFileSync(join(root, 'next.config.mjs'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

test('production config disables public source maps and browser-initiated display capture', () => {
  assert.match(nextConfig, /poweredByHeader:\s*false/);
  assert.match(nextConfig, /productionBrowserSourceMaps:\s*false/);
  assert.match(nextConfig, /Permissions-Policy['"],\s*value:\s*['"]display-capture=\(\)['"]/);
  assert.match(nextConfig, /X-Frame-Options['"],\s*value:\s*['"]SAMEORIGIN['"]/);
  assert.match(nextConfig, /X-Permitted-Cross-Domain-Policies['"],\s*value:\s*['"]none['"]/);
});

test('production build runs the public source map artifact guard', () => {
  assert.match(packageJson.scripts.build, /assert-no-public-sourcemaps\.mjs/);
});
