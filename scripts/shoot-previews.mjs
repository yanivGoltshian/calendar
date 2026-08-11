import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3003';
const OUT = 'public/brand/mascots/previews';
mkdirSync(OUT, { recursive: true });

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

// section id -> filename slug
const sections = [
  ['hero', null], // top viewport
  ['audiences', 'audiences'],
  ['features', 'features'],
  ['how-it-works', 'how-it-works'],
  ['migrate', 'migrate'],
];

async function settle(page, ms = 700) {
  await page.waitForTimeout(ms);
}

const browser = await chromium.launch();
try {
  for (const [name, vp] of Object.entries(viewports)) {
    const ctx = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 2,
      locale: 'he-IL',
      reducedMotion: 'reduce', // deterministic, no mid-flight animation frames
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    await settle(page, 1200);

    // Full page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await settle(page, 900);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 600);
    await page.screenshot({ path: `${OUT}/home-full-${name}.png`, fullPage: true });
    console.log(`✓ home-full-${name}.png`);

    // Hero = top viewport
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 400);
    await page.screenshot({ path: `${OUT}/hero-${name}.png` });
    console.log(`✓ hero-${name}.png`);

    // Per-section element shots
    for (const [id, slug] of sections) {
      if (!slug) continue;
      const el = page.locator(`#${id}`).first();
      if ((await el.count()) === 0) {
        console.log(`… #${id} not found, skipping`);
        continue;
      }
      await el.scrollIntoViewIfNeeded();
      await settle(page, 700);
      await el.screenshot({ path: `${OUT}/${slug}-${name}.png` });
      console.log(`✓ ${slug}-${name}.png`);
    }

    // Business demo page (full)
    const bizPage = await ctx.newPage();
    await bizPage.goto(`${BASE}/b/demo-barbershop`, { waitUntil: 'load' });
    await settle(bizPage, 1200);
    await bizPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await settle(bizPage, 700);
    await bizPage.evaluate(() => window.scrollTo(0, 0));
    await settle(bizPage, 500);
    await bizPage.screenshot({ path: `${OUT}/biz-full-${name}.png`, fullPage: true });
    console.log(`✓ biz-full-${name}.png`);
    await bizPage.screenshot({ path: `${OUT}/biz-hero-${name}.png` });
    console.log(`✓ biz-hero-${name}.png`);
    await bizPage.close();

    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('done');
