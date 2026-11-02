import { Chess } from 'chess.js';
import { Board } from './board';
import { applyRealm, currentRealm, REALMS } from './realms';
import { save } from './store';

/** Morphy's Opera Game (1858): public domain, full of captures, castling and a mate in 17. */
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#'
  .split(/\s*\d+\.\s*/)
  .join(' ')
  .trim()
  .split(/\s+/);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function homeView() {
  const el = document.createElement('section');
  el.className = 'home';
  el.innerHTML = `
    <div class="hero">
      <div class="hero-copy">
        <h1>Chess where the pieces fight back.</h1>
        <p class="lede">Every capture is a duel. Pick a realm, choose an opponent that fits your level, and learn the game with a coach who warns you before you give a piece away.</p>
        <div class="cta">
          <a class="btn big" href="#/learn">Learn chess</a>
          <a class="btn big ghost" href="#/play">Play a game</a>
        </div>
        <p class="fine">Free, no sign-up. The opponent runs in your browser.</p>
      </div>
      <div class="hero-board" aria-label="A demo game playing itself"><div class="demo-cap"><span class="demo-title">Now playing</span><span class="demo-san"></span></div></div>
    </div>
    <div class="realm-cards" role="list">
      ${REALMS.map(
        (r) => `<button class="realm-card" role="listitem" data-realm="${r.id}" style="--s1:${r.swatch[0]};--s2:${r.swatch[1]};--s3:${r.swatch[2]}">
          <span class="swatch"></span><strong>${r.name}</strong><span class="tag">${r.tagline}</span><span class="duel">${r.duel}: ${r.blurb}</span>
        </button>`
      ).join('')}
    </div>`;

  const board = new Board({ interactive: false });
  board.speed = 0.85;
  el.querySelector('.hero-board')!.prepend(board.root);
  const san = el.querySelector('.demo-san')!;
  const chess = new Chess();
  board.setPosition(chess.fen());
  let alive = true;
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(el);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (async () => {
    if (reduce) {
      // static mid-game position
      const c = new Chess();
      for (const m of OPERA.slice(0, 22)) c.move(m);
      board.setPosition(c.fen());
      san.textContent = 'Morphy vs the Duke, 1858';
      return;
    }
    await sleep(900);
    while (alive) {
      chess.reset();
      board.setPosition(chess.fen());
      await sleep(700);
      for (let i = 0; i < OPERA.length && alive; i++) {
        while ((!visible || document.hidden) && alive) await sleep(400);
        const m = chess.move(OPERA[i]!);
        san.textContent = `${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'} ${m.san}`;
        await board.move(m);
        await sleep(m.captured ? 650 : 300);
      }
      await sleep(3200);
    }
  })();

  el.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.realm-card');
    if (card) {
      applyRealm(card.dataset.realm as never);
      save({ realm: card.dataset.realm as never });
    }
  });
  const sync = () => el.querySelectorAll<HTMLElement>('.realm-card').forEach((c) => c.classList.toggle('on', c.dataset.realm === currentRealm()));
  document.addEventListener('realmchange', sync);
  sync();
  return {
    el,
    destroy() {
      alive = false;
      io.disconnect();
      document.removeEventListener('realmchange', sync);
      board.destroy();
    },
  };
}
