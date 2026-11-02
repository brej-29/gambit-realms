import { Chess, type Square } from 'chess.js';
import { Board } from './board';
import { LESSONS, type Lesson } from './lessons';
import { pieceSvg } from './pieces';
import { play as sfx } from './audio';
import { progress, saveProgress, settings } from './store';

export function academyList() {
  const el = document.createElement('section');
  el.className = 'academy';
  const done = LESSONS.filter((l) => progress.lessons[l.id]).length;
  el.innerHTML = `
    <header class="page-head"><h1>Learn chess</h1>
      <p class="lede">Eight short lessons. Each one is a few moves on the real board, with a coach that tells you what went right. ${done ? `You have finished ${done} of ${LESSONS.length}.` : 'No experience needed.'}</p></header>
    <ol class="lesson-grid">
      ${LESSONS.map((l, i) => `<li><a class="lesson-card ${progress.lessons[l.id] ? 'done' : ''}" href="#/learn/${l.id}">
        <span class="lesson-no" aria-hidden="true">${progress.lessons[l.id] ? '✓' : i + 1}</span>
        <strong>${l.title}</strong><span class="sub">${l.blurb}</span><span class="steps">${l.steps.length} step${l.steps.length > 1 ? 's' : ''}</span></a></li>`).join('')}
    </ol>
    <div class="academy-cta"><p>Finished the lessons, or just curious?</p><a class="btn big" href="#/play?first=1">Play your first game</a></div>`;
  return { el, destroy() {} };
}

export function lessonView(lesson: Lesson) {
  const el = document.createElement('section');
  el.className = 'lesson';
  el.innerHTML = `
    <div class="game-board"></div>
    <aside class="side">
      <div class="card lesson-card-main">
        <div class="lesson-top"><a class="back" href="#/learn">All lessons</a><span class="dots" aria-label="Progress"></span></div>
        <h2>${lesson.title}</h2>
        <div class="coach-row"><div class="avatar coach-av w">${pieceSvg('p')}</div><p class="bubble" aria-live="polite"></p></div>
        <div class="feedback" role="status"></div>
        <div class="row"><button class="btn ghost" data-a="show">Show me</button><button class="btn" data-a="next" hidden>Next</button></div>
      </div>
    </aside>`;
  const board = new Board({ onSquare: (sq) => onSquare(sq) });
  board.speed = settings.speed === 'fast' ? 0.6 : 1;
  el.querySelector('.game-board')!.append(board.root);
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;

  let i = 0;
  let chess = new Chess();
  let selected: Square | null = null;
  let solved = false;
  let busy = false;
  let gone = false;

  const dots = () => (q('.dots').innerHTML = lesson.steps.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'c' : ''}"></i>`).join(''));
  const say = (t: string) => {
    q('.bubble').textContent = t;
    q('.bubble').animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220 });
  };
  const feedback = (t: string, kind: 'ok' | 'bad' | '' = '') => {
    const f = q('.feedback');
    f.textContent = t;
    f.className = `feedback ${kind}`;
  };

  function load() {
    const s = lesson.steps[i]!;
    chess = new Chess(s.fen);
    selected = null;
    solved = false;
    board.setPosition(s.fen);
    say(s.say);
    feedback('');
    q('[data-a=next]').hidden = true;
    q('[data-a=show]').hidden = !!s.look;
    if (s.look) {
      q<HTMLButtonElement>('[data-a=next]').hidden = false;
      q('[data-a=next]').textContent = i === lesson.steps.length - 1 ? 'Finish' : 'Next';
    }
    dots();
  }

  function succeed(msg: string) {
    solved = true;
    selected = null;
    feedback(msg, 'ok');
    sfx('win', board.realm);
    const n = q('[data-a=next]');
    n.hidden = false;
    n.textContent = i === lesson.steps.length - 1 ? 'Finish lesson' : 'Next';
    (n as HTMLElement).focus();
  }

  const wrong = (msg: string) => {
    sfx('warn', board.realm);
    feedback(msg, 'bad');
    board.root.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 240 });
  };

  async function onSquare(sq: Square) {
    const s = lesson.steps[i]!;
    if (busy || solved) return;
    if (s.click) {
      if (s.click.includes(sq)) {
        board.mark({ selected: sq, danger: lesson.id === 'safety' ? [sq] : [] });
        succeed(s.ok);
      } else wrong(s.wrong ?? 'Not that square. Try again.');
      return;
    }
    if (selected) {
      const ms = chess.moves({ square: selected, verbose: true }).filter((m) => m.to === sq);
      if (ms.length && !s.look) return void attempt(ms[0]!.from, sq);
    }
    const p = chess.get(sq);
    if (p && p.color === 'w' && sq !== selected) {
      selected = sq;
      sfx('select', board.realm);
      board.mark({ selected, targets: chess.moves({ square: sq, verbose: true }).map((m) => ({ sq: m.to, capture: !!m.captured })) });
    } else {
      selected = null;
      board.mark({});
    }
  }

  async function attempt(from: Square, to: Square) {
    const s = lesson.steps[i]!;
    const key = from + to;
    const test = new Chess(s.fen);
    test.move({ from, to, promotion: 'q' });
    const good = s.expect === 'mate' ? test.isCheckmate() : s.expect?.includes(key);
    const alt = !good && s.alt?.includes(key);
    if (!good && !alt) {
      selected = null;
      board.mark({});
      return wrong(s.wrong ?? 'Not quite. Try another move.');
    }
    busy = true;
    selected = null;
    board.mark({ last: [from, to] });
    const real = chess.move({ from, to, promotion: 'q' });
    await board.move(real);
    if (gone) return;
    if (test.isCheckmate()) await board.checkmate('b');
    busy = false;
    succeed(alt ? s.altOk ?? s.ok : s.ok);
  }

  function show() {
    const s = lesson.steps[i]!;
    const first = s.click?.[0] ?? (Array.isArray(s.expect) ? s.expect[0] : undefined);
    if (s.click) board.mark({ hint: [s.click[0]!, s.click[0]!] });
    else if (first) board.mark({ hint: [first.slice(0, 2) as Square, first.slice(2, 4) as Square] });
    else if (s.expect === 'mate') {
      const m = new Chess(s.fen).moves({ verbose: true }).find((x) => { const t = new Chess(s.fen); t.move(x); return t.isCheckmate(); });
      if (m) board.mark({ hint: [m.from, m.to] });
    }
  }

  function next() {
    if (i < lesson.steps.length - 1) {
      i++;
      load();
      return;
    }
    progress.lessons[lesson.id] = true;
    saveProgress();
    const idx = LESSONS.findIndex((l) => l.id === lesson.id);
    const nextLesson = LESSONS[idx + 1];
    q('.lesson-card-main').innerHTML = `
      <h2>Lesson complete</h2><p class="lede">${lesson.title}: done. ${nextLesson ? `Up next: ${nextLesson.title}.` : 'You know every rule you need.'}</p>
      <div class="row">${nextLesson ? `<a class="btn" href="#/learn/${nextLesson.id}">Next lesson</a>` : '<a class="btn" href="#/play?first=1">Play your first game</a>'}<a class="btn ghost" href="#/learn">All lessons</a></div>`;
    sfx('promote', board.realm);
  }

  el.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a === 'next') next();
    if (a === 'show') show();
  });
  load();
  return {
    el,
    destroy() {
      gone = true;
      board.destroy();
    },
  };
}
