// Dev check: run axe-core on every route in every realm. Usage: node scripts/a11y.mjs [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const axeSrc = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2] ?? 'http://localhost:5200/';
const routes = ['#/', '#/learn', '#/learn/pawn', '#/play', '#/evidence'];
const realms = ['enchanted', 'medieval', 'cyberpunk', 'anime'];
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let total = 0;
for (const realm of realms) {
  for (const r of routes) {
    await page.goto(base);
    await page.evaluate((id) => document.querySelector(`.chip[data-realm=${id}]`)?.click(), realm);
    await page.evaluate((h) => (location.hash = h), r);
    await page.waitForTimeout(1300);
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } }));
    console.log(realm, r, 'passes', res.passes.length, 'incomplete', res.incomplete.map((i) => i.id + ':' + i.nodes.length).join(','));
    for (const v of res.violations) {
      total++;
      console.log(`[${realm} ${r}] ${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')} :: ${(v.nodes[0].any[0]?.message ?? '').slice(0, 110)}`);
    }
  }
}
console.log(total ? `${total} violation groups` : 'no violations');
await browser.close();
process.exit(total ? 1 : 0);
