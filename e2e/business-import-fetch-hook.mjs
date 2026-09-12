import { readFileSync } from 'node:fs';

const originalFetch = globalThis.fetch;
const fixtures = new Map([
  ['/business-import-fixture', 'generic-home.html'],
  ['/services', 'generic-services.html'],
  ['/about', 'generic-about.html'],
  ['/contact', 'generic-contact.html'],
  ['/gallery', 'generic-gallery.html'],
]);

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === 'https://8.8.8.8' && fixtures.has(url.pathname)) {
    const filename = fixtures.get(url.pathname);
    const body = readFileSync(
      new URL(`../src/server/businessImport/__fixtures__/${filename}`, import.meta.url),
      'utf8',
    );
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  if (url.origin === 'https://8.8.8.8' && url.pathname === '/pricing') {
    return new Response('<html><body>Pricing</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  return originalFetch(input, init);
};
