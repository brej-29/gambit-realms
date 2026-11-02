// Regenerates the README screenshots. Needs `npm run dev` on the given URL (the debug hook is dev-only).
// Usage: E2E_CHANNEL=msedge node scripts/shots.mjs http://localhost:5173/
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {});
const out = (n) => `docs/img/${n}.png`;
const FEN = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

for (const realm of ['enchanted', 'medieval', 'cyberpunk', 'anime']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
  await page.goto(base + '#/play', { waitUntil: 'networkidle' });
  await page.evaluate((r) => document.querySelector(`.chip[data-realm=${r}]`).click(), realm);
  await page.waitForTimeout(1500);
  await page.click('[data-k="0"]');
  await page.click('.start');
  await page.waitForTimeout(1200);
  await page.evaluate((fen) => {
    const g = window.__game;
    g.chess.load(fen);
    g.board.setPosition(fen);
    g.commit({ from: 'e4', to: 'd5' });
  }, FEN);
  await page.waitForTimeout(realm === 'cyberpunk' ? 520 : realm === 'anime' ? 560 : 640);
  await page.screenshot({ path: out(`capture-${realm}`) });
  await page.close();
}

// 2x2 collage of the four capture frames, cropped to the board area
const imgs = ['enchanted', 'medieval', 'cyberpunk', 'anime'].map((r) => 'data:image/png;base64,' + readFileSync(out('capture-' + r)).toString('base64'));
const col = await browser.newPage({ viewport: { width: 1280, height: 780 } });
await col.setContent('<body style="margin:0;display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#111">' + imgs.map((i) => '<div style="height:387px;overflow:hidden"><img src="' + i + '" style="width:1280px;margin:-215px 0 0 -120px;display:block"></div>').join('') + '</body>');
await col.screenshot({ path: out('captures') });
await col.close();

const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(4200);
await page.screenshot({ path: out('home') });
await page.goto(base + '#/play?first=1', { waitUntil: 'networkidle' });
await page.click('.start');
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = window.__game;
  const fen = '4k3/8/8/2p5/8/8/8/3QK3 w - - 0 1';
  g.chess.load(fen);
  g.board.setPosition(fen);
  g.paint();
  g.onSquare('d1');
  setTimeout(() => g.onSquare('d4'), 250);
});
await page.waitForTimeout(1200);
await page.screenshot({ path: out('coach-warning') });
await page.goto(base + '#/evidence', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: out('evidence'), fullPage: true });
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(base + '#/play?first=1', { waitUntil: 'networkidle' });
await m.click('.start');
await m.waitForTimeout(1500);
await m.screenshot({ path: out('mobile') });
await browser.close();
console.log('screenshots written to docs/img');
