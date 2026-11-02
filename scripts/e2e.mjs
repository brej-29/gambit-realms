// End-to-end smoke test. Usage: node scripts/e2e.mjs <baseUrl>   (set E2E_CHANNEL=msedge to use system Edge)
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const steps = [];
const ok = (name) => (steps.push(name), console.log('ok  ', name));
const fail = async (name, err) => {
  console.error('FAIL', name, String(err).split('\n')[0]);
  await page.screenshot({ path: 'e2e-failure.png' });
  await browser.close();
  process.exit(1);
};
const step = async (name, fn) => {
  try {
    await fn();
    ok(name);
  } catch (e) {
    await fail(name, e);
  }
};

await step('home renders with a demo board', async () => {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1');
  await page.waitForSelector('.hero-board .piece');
});
await step('realm switch changes the theme', async () => {
  await page.click('.chip[data-realm=anime]');
  await page.waitForFunction(() => document.documentElement.dataset.realm === 'anime');
  await page.click('.chip[data-realm=enchanted]');
});
await step('lesson: click squares then advance', async () => {
  await page.goto(base + '#/learn/board');
  await page.click('button[data-sq=e4]');
  await page.waitForSelector('[data-a=next]:not([hidden])');
});
await step('lesson: make the expected pawn move', async () => {
  await page.goto(base + '#/learn/pawn');
  await page.click('button[data-sq=e2]');
  await page.click('button[data-sq=e4]');
  await page.waitForSelector('.feedback.ok', { timeout: 6000 });
});
await step('game: play e4 and get an engine reply', async () => {
  await page.goto(base + '#/play?first=1');
  await page.click('.start');
  await page.waitForSelector('.game .piece');
  await page.click('button[data-sq=e2]');
  await page.click('button[data-sq=e4]');
  await page.waitForFunction(() => document.querySelectorAll('.movelist li span:nth-child(3)').length && [...document.querySelectorAll('.movelist li span:nth-child(3)')].some((s) => s.textContent), null, { timeout: 25000 });
});
if (errors.length) {
  console.error('console errors:', errors.slice(0, 5));
  await browser.close();
  process.exit(1);
}
console.log(`e2e passed (${steps.length} steps)`);
await browser.close();
