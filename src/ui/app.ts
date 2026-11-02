import { academyList, lessonView } from './academy';
import { audio } from './audio';
import { fx } from './fx';
import { GameView, type GameOptions } from './game';
import { homeView } from './home';
import { LESSONS } from './lessons';
import { pieceSvg } from './pieces';
import { applyRealm, currentRealm, REALMS } from './realms';
import { save, settings } from './store';
import { setupView } from './setup';
import { evidenceView } from './evidence';

interface View {
  el: HTMLElement;
  destroy(): void;
}

const motes = () =>
  Array.from({ length: 16 }, () => `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(-Math.random() * 24).toFixed(1)}s;--t:${(14 + Math.random() * 16).toFixed(1)}s;--s:${(0.6 + Math.random() * 1.2).toFixed(2)}"></i>`).join("");

export function start(root: HTMLElement) {
  document.documentElement.dataset.realm = settings.realm;
  audio.muted = !settings.sound;
  fx.mount();

  root.innerHTML = `
    <div class="world" aria-hidden="true">${motes()}</div>
    <a class="skip" href="#main">Skip to content</a>
    <header class="top">
      <a class="logo" href="#/" aria-label="Gambit Realms home"><span class="logo-mark w">${pieceSvg('n')}</span><span class="logo-text">Gambit Realms</span></a>
      <nav class="nav" aria-label="Main"><a href="#/learn" data-nav="learn">Learn</a><a href="#/play" data-nav="play">Play</a><a href="#/evidence" data-nav="evidence">Evidence</a></nav>
      <div class="tools">
        <div class="realm-chips" role="radiogroup" aria-label="Realm">
          ${REALMS.map((r) => `<button class="chip" role="radio" data-realm="${r.id}" aria-checked="false" aria-label="${r.name}" title="${r.name}" style="--s1:${r.swatch[0]};--s2:${r.swatch[1]};--s3:${r.swatch[2]}"></button>`).join('')}
        </div>
        <button class="icon-btn" id="snd" aria-pressed="true" aria-label="Sound"></button>
      </div>
    </header>
    <main id="main" tabindex="-1"></main>`;
  const main = root.querySelector<HTMLElement>('#main')!;
  let view: View | null = null;
  let game: GameOptions | null = null;

  const chips = () =>
    root.querySelectorAll<HTMLElement>('.chip').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.realm === currentRealm())));
  const snd = root.querySelector<HTMLElement>('#snd')!;
  const paintSnd = () => {
    snd.setAttribute('aria-pressed', String(!audio.muted));
    snd.innerHTML = audio.muted
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  };
  snd.addEventListener('click', () => {
    audio.muted = !audio.muted;
    save({ sound: !audio.muted });
    paintSnd();
  });
  root.querySelector('.realm-chips')!.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!c) return;
    applyRealm(c.dataset.realm as never);
    save({ realm: c.dataset.realm as never });
  });
  document.addEventListener('realmchange', chips);
  chips();
  paintSnd();

  function mount(v: View, nav: string) {
    view?.destroy();
    view = v;
    main.textContent = '';
    main.append(v.el);
    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
    scrollTo(0, 0);
  }

  const go = (h: string) => (location.hash = h);

  function startGame(o: GameOptions) {
    game = o;
    const g = new GameView(o, (to) => {
      if (to === 'home') go('#/');
      else {
        game = null;
        render();
      }
    });
    mount({ el: g.el, destroy: () => g.destroy() }, 'play');
  }

  document.addEventListener('restart-game', ((e: CustomEvent<GameOptions>) => startGame(e.detail)) as EventListener);

  function render() {
    const [path = '', arg] = location.hash.replace(/^#\/?/, '').split('?')[0]!.split('/');
    const query = new URLSearchParams(location.hash.split('?')[1] ?? '');
    document.title = 'Gambit Realms';
    if (path === 'learn' && arg) {
      const l = LESSONS.find((x) => x.id === arg);
      if (l) return mount(lessonView(l), 'learn');
    }
    if (path === 'learn') return mount(academyList(), 'learn');
    if (path === 'evidence') return mount(evidenceView(), 'evidence');
    if (path === 'play') {
      if (game && view && view.el.classList.contains('game')) return;
      return mount(setupView(startGame, { first: query.has('first') }), 'play');
    }
    mount(homeView(), '');
  }
  addEventListener('hashchange', () => {
    if (location.hash.startsWith('#/play') && game && view?.el.classList.contains('game')) return;
    game = location.hash.startsWith('#/play') ? game : null;
    render();
  });
  render();
}
