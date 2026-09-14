// capture.mjs — deterministic frame capture for the Torchick ad
// Usage:
//   node capture.mjs test <t> <outfile.png>     -> render ONE frame at time t (seconds)
//   node capture.mjs all                        -> render all frames to ../frames
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AD = pathToFileURL(path.resolve(__dirname, '..', 'ad.html')).href;
const FPS = 30;
const DUR = 30.0;
const W = 1080, H = 1920;

async function newPage(browser){
  const ctx = await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
  const page = await ctx.newPage();
  await page.goto(AD, { waitUntil:'load' });
  // wait for fonts + all images decoded + engine ready
  await page.waitForFunction(() => document.documentElement.getAttribute('data-ready')==='1');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map(im => im.complete && im.naturalWidth>0 ? Promise.resolve()
      : new Promise(r => { im.onload = r; im.onerror = r; })));
  });
  return { ctx, page };
}

async function main(){
  const mode = process.argv[2] || 'all';
  const browser = await chromium.launch({ args:['--force-color-profile=srgb','--hide-scrollbars'] });
  const { ctx, page } = await newPage(browser);

  if (mode === 'test'){
    const t = parseFloat(process.argv[3] ?? '10');
    const out = process.argv[4] ?? path.resolve(__dirname,'..','test-frame.png');
    await page.evaluate((tt)=>window.__seek(tt), t);
    await page.waitForTimeout(120);
    const el = await page.$('#stage');
    await el.screenshot({ path: out });
    console.log('wrote', out, 'at t=', t);
    await browser.close();
    return;
  }

  // full capture
  const outDir = path.resolve(__dirname,'..','frames');
  fs.rmSync(outDir,{recursive:true,force:true});
  fs.mkdirSync(outDir,{recursive:true});
  const total = Math.round(DUR*FPS);
  const stage = await page.$('#stage');
  const t0 = Date.now();
  for (let i=0;i<total;i++){
    const t = i/FPS;
    await page.evaluate((tt)=>window.__seek(tt), t);
    const name = 'frame_'+String(i).padStart(5,'0')+'.png';
    await stage.screenshot({ path: path.join(outDir,name) });
    if (i%60===0){
      const el = (Date.now()-t0)/1000;
      console.log(`  ${i}/${total}  (${el.toFixed(1)}s)`);
    }
  }
  console.log('done', total, 'frames in', ((Date.now()-t0)/1000).toFixed(1),'s ->', outDir);
  await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
