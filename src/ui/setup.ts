import { LEVELS_UI } from './levels';
import { mini } from './mini';
import { save, settings } from './store';
import type { GameOptions } from './game';
import { brain } from './brain';
import { levelStrength, loadResults } from './results';

export function setupView(onStart: (o: GameOptions) => void, preset?: { first?: boolean }) {
  if (preset?.first) save({ level: 1, coach: true, color: 'w' });
  const el = document.createElement('section');
  el.className = 'setup';
  el.innerHTML = `
    <header class="page-head"><h1>Choose your opponent</h1>
      <p class="lede">New to chess? Start with Sleepy Pawn and keep the coach on. You can change both at any time.</p></header>
    <div class="setup-grid">
      <fieldset class="levels"><legend>Opponent</legend>
        <div class="level-row" role="radiogroup" aria-label="Opponent level">
          ${LEVELS_UI.map((l) => `<button type="button" role="radio" class="level" data-l="${l.id}" aria-checked="false"><span class="lv-art ${l.id % 2 ? 'w' : 'bk'}">${mini(l.piece)}</span><span class="lv-no">${l.id}</span><span class="lv-name">${l.name}</span></button>`).join('')}
        </div>
        <div class="level-detail" aria-live="polite"></div>
      </fieldset>
      <div class="setup-side">
        <fieldset><legend>You play</legend>
          <div class="seg" role="radiogroup" aria-label="Your colour">
            <button type="button" role="radio" data-c="w">White</button><button type="button" role="radio" data-c="b">Black</button><button type="button" role="radio" data-c="r">Random</button>
          </div></fieldset>
        <fieldset><legend>Coach</legend>
          <div class="seg" role="radiogroup" aria-label="Coach">
            <button type="button" role="radio" data-k="1">On</button><button type="button" role="radio" data-k="0">Off</button>
          </div>
          <p class="hint">On: legal-move dots, a glow on pieces that can be captured, and a warning before a move that loses material.</p></fieldset>
        <fieldset><legend>Duel speed</legend>
          <div class="seg" role="radiogroup" aria-label="Animation speed">
            <button type="button" role="radio" data-s="normal">Full show</button><button type="button" role="radio" data-s="fast">Quick</button>
          </div></fieldset>
        <button class="btn big start" type="button">Begin the duel</button>
      </div>
    </div>`;

  const paint = () => {
    el.querySelectorAll<HTMLElement>('.level').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.l) === settings.level)));
    el.querySelectorAll<HTMLElement>('[data-c]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.c === settings.color)));
    el.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.k === '1') === settings.coach)));
    el.querySelectorAll<HTMLElement>('[data-s]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.s === settings.speed)));
    const lv = LEVELS_UI[settings.level - 1]!;
    const s = levelStrength(settings.level);
    el.querySelector('.level-detail')!.innerHTML = `<strong>${lv.name}</strong><p>${lv.blurb}</p>${s ? `<p class="measured">Measured strength: <b>${s}</b> <a href="#/evidence">how we measured</a></p>` : ''}`;
  };
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const l = t.closest<HTMLElement>('.level');
    const c = t.closest<HTMLElement>('[data-c]');
    const k = t.closest<HTMLElement>('[data-k]');
    const sp = t.closest<HTMLElement>('[data-s]');
    if (l) save({ level: Number(l.dataset.l) });
    if (c) save({ color: c.dataset.c as 'w' | 'b' | 'r' });
    if (k) save({ coach: k.dataset.k === '1' });
    if (sp) save({ speed: sp.dataset.s as 'normal' | 'fast' });
    if (t.closest('.start')) {
      const human = settings.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.color;
      onStart({ level: settings.level, human, coach: settings.coach });
      return;
    }
    paint();
  });
  paint();
  void loadResults().then(paint);
  brain.warm();
  return { el, destroy() {} };
}
