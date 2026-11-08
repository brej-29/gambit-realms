// Records the README animations. Needs `npm run dev` (the debug hook is dev-only), Edge or Chromium, and ffmpeg.
// Usage: E2E_CHANNEL=msedge node scripts/gifs.mjs http://localhost:5173/ [scene ...]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5173/';
const only = process.argv.slice(3);
const W = 1280, H = 760;
const tmp = join(tmpdir(), 'gambit-gifs');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync('docs/img', { recursive: true });
const browser = await chromium.launch(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {});
const CAPTURE_FEN = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

async function scene(name, fn, { fps = 12, width = 800, seconds } = {}) {
  if (only.length && !only.includes(name)) return;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const mark = { at: 0 };
  await fn(page, () => (mark.at = (Date.now() - t0) / 1000));
  await ctx.close();
  const video = readdirSync(tmp).find((f) => f.endsWith('.webm') && !f.startsWith('scene-'));
  renameSync(join(tmp, video), join(tmp, `scene-${name}.webm`));
  const args = ['-y', '-ss', String(mark.at), ...(seconds ? ['-t', String(seconds)] : []), '-i', join(tmp, `scene-${name}.webm`),
    '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, '-loop', '0', `docs/img/${name}.gif`];
  execFileSync('ffmpeg', args, { stdio: 'ignore' });
  console.log('wrote', `docs/img/${name}.gif`);
}

const clickSquare = async (page, sq) => {
  const box = await page.locator(`button[data-sq=${sq}]`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
const clickPiece = async (page, sq) => {
  const box = await page.locator(`.piece[data-sq=${sq}] .hop`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
};

async function startGame(page, realm, coach) {
  await page.goto(base + '#/play', { waitUntil: 'networkidle' });
  await page.evaluate((r) => document.querySelector(`.chip[data-realm=${r}]`).click(), realm);
  await page.waitForTimeout(1400);
  await page.click(coach ? '[data-k="1"]' : '[data-k="0"]');
  await page.click('.start');
  await page.waitForSelector('.game .piece');
  await page.waitForTimeout(900);
}

for (const realm of ['enchanted', 'medieval', 'cyberpunk', 'anime']) {
  await scene(`realm-${realm}`, async (page, start) => {
    await startGame(page, realm, false);
    await page.evaluate((fen) => {
      const g = window.__game;
      g.chess.load(fen);
      g.board.setPosition(fen);
      g.paint();
    }, CAPTURE_FEN);
    await page.waitForTimeout(500);
    start();
    await clickPiece(page, 'e4');
    await page.waitForTimeout(900);
    await clickPiece(page, 'd5');
    await page.waitForTimeout(3300);
  }, { seconds: 5.2 });
}

await scene('coach-warning', async (page, start) => {
  await startGame(page, 'enchanted', true);
  await page.evaluate(() => {
    const fen = '4k3/8/8/2p5/8/8/8/3QK3 w - - 0 1';
    const g = window.__game;
    g.chess.load(fen);
    g.board.setPosition(fen);
    g.paint();
  });
  await page.waitForTimeout(600);
  start();
  await clickPiece(page, 'd1');
  await page.waitForTimeout(1000);
  await clickSquare(page, 'd4');
  await page.waitForTimeout(2200);
  await page.click('[data-w=no]');
  await page.waitForTimeout(900);
}, { seconds: 6.2 });

await scene('lesson', async (page, start) => {
  await page.goto(base + '#/learn/pawn', { waitUntil: 'networkidle' });
  await page.waitForSelector('.piece');
  await page.waitForTimeout(900);
  start();
  await page.waitForTimeout(1200);
  await clickPiece(page, 'e2');
  await page.waitForTimeout(1000);
  await clickSquare(page, 'e4');
  await page.waitForTimeout(2600);
}, { seconds: 5.6 });

await scene('realm-switch', async (page, start) => {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  start();
  for (const r of ['medieval', 'cyberpunk', 'anime', 'enchanted']) {
    await page.waitForTimeout(1500);
    await page.evaluate((id) => document.querySelector(`.chip[data-realm=${id}]`).click(), r);
  }
  await page.waitForTimeout(1800);
}, { seconds: 8.4, fps: 10, width: 800 });

await scene('home-demo', async (page, start) => {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  start();
  await page.waitForTimeout(13000);
}, { seconds: 13, fps: 10, width: 800 });

await browser.close();
