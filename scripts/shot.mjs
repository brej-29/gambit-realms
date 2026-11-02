// Dev helper: node scripts/shot.mjs <url> <out.png> [width] [height] [jsToRunFirst] [waitMs]
import { chromium } from 'playwright-core';

const [url, out, w = '1400', h = '860', js = '', wait = '800'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
if (js) await page.evaluate(`(async()=>{${js}})()`);
let prev = 0;
for (const t of wait.split(",").map(Number)) {
  await page.waitForTimeout(t - prev);
  prev = t;
  await page.screenshot({ path: wait.includes(",") ? out.replace(/.png$/, `-${t}.png`) : out });
}
if (errors.length) console.log('console errors:', errors.slice(0, 5));
await browser.close();
