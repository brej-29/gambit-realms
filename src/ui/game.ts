import { Chess, type Move, type Square } from 'chess.js';
import { Board, type Color } from './board';
import { brain } from './brain';
import { play as sfx } from './audio';
import { LEVELS_UI } from './levels';
import { pieceSvg, PIECE_NAMES, type PieceType } from './pieces';
import { popText } from './fx';
import { progress, saveProgress, settings } from './store';

export interface GameOptions {
  level: number;
  human: Color;
  coach: boolean;
}
type End = { kind: 'mate' | 'stalemate' | 'draw' | 'resign'; winner?: Color; why?: string };

const TIPS = [
  'Fight for the middle of the board. Pawns on e4 and d4 help your pieces breathe.',
  'Bring out your knights and bishops before you move your queen.',
  'Castle early. It tucks your king away and wakes up a rook.',
  'Before every move, ask: what can they capture now?',
  'A piece that is protected can be traded. A piece that is not protected can be lost.',
];

const mini = (type: PieceType, color: Color) => `<span class="mini ${color === 'w' ? 'w' : 'bk'}">${pieceSvg(type)}</span>`;
const pname = (t: string) => PIECE_NAMES[t as PieceType];
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export class GameView {
  readonly el = document.createElement('section');
  private chess = new Chess();
  private board: Board;
  private selected: Square | null = null;
  private busy = false;
  private over = false;
  private gone = false;
  private hintMark: [Square, Square] | null = null;
  private pending: { from: Square; to: Square; promotion?: string } | null = null;
  private q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;

  constructor(private o: GameOptions, private onExit: (to: 'setup' | 'home') => void) {
    const lv = LEVELS_UI[o.level - 1]!;
    this.el.className = 'game';
    this.el.innerHTML = `
      <div class="game-board"><div class="banner" aria-hidden="true"></div><div class="promo" hidden></div></div>
      <aside class="side">
        <div class="card opp">
          <div class="avatar opp-av ${o.human === 'w' ? 'bk' : 'w'}">${pieceSvg(lv.piece)}</div>
          <div class="who"><strong>${lv.name}</strong><span class="sub">Level ${lv.id} opponent</span><span class="status" role="status"></span></div>
          <div class="tray tray-opp" aria-label="Pieces you captured"></div>
        </div>
        ${o.coach ? `<div class="card coach"><div class="avatar coach-av w">${pieceSvg('p')}</div><div class="bubble" aria-live="polite"></div><div class="coach-actions" hidden></div></div>` : ''}
        <div class="card moves"><h3>Moves</h3><ol class="movelist" aria-label="Move list"></ol></div>
        <div class="card you">
          <div class="who"><strong>You</strong><span class="sub turn"></span></div>
          <div class="tray tray-you" aria-label="Pieces you lost"></div>
        </div>
        <div class="actions">
          <button class="btn ghost" data-act="undo">Take back</button>
          ${o.coach ? '<button class="btn ghost" data-act="hint">Hint</button>' : ''}
          <button class="btn ghost" data-act="resign">Resign</button>
        </div>
      </aside>
      <div class="result" hidden></div>`;
    this.board = new Board({ orientation: o.human, onSquare: (sq) => this.onSquare(sq) });
    this.board.speed = settings.speed === 'fast' ? 0.6 : 1;
    this.q('.game-board').prepend(this.board.root);
    this.board.setPosition(this.chess.fen());
    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'undo') void this.undo();
      if (act === 'hint') void this.hint();
      if (act === 'resign') this.resign();
    });
    this.say(o.coach ? "I'm Pip, your coach. Tap a piece to see where it can go. I'll warn you before you give a piece away." : '');
    this.refresh();
    if (import.meta.env.DEV) (window as unknown as { __game: GameView }).__game = this;
    if (o.human === 'b') void this.opponentTurn();
  }

  destroy() {
    this.gone = true;
    this.board.destroy();
    this.el.remove();
  }

  /* ---------- ui helpers ---------- */
  private say(text: string) {
    if (!this.o.coach) return;
    const b = this.q('.bubble');
    b.textContent = text;
    b.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }
  private paint(extra: { danger?: Square[] } = {}) {
    const targets = this.selected ? this.chess.moves({ square: this.selected, verbose: true }).map((m) => ({ sq: m.to, capture: !!m.captured })) : [];
    const hist = this.chess.history({ verbose: true });
    const lastM = hist[hist.length - 1];
    const king = this.chess.inCheck() ? this.kingSquare(this.chess.turn()) : null;
    this.board.mark({
      selected: this.selected, targets, last: lastM ? [lastM.from, lastM.to] : null,
      check: king, hint: this.hintMark, danger: extra.danger ?? this.dangerSquares(),
    });
  }
  private dangerSquares(): Square[] {
    if (!this.o.coach || this.over || this.chess.turn() !== this.o.human) return [];
    return brain.threats(this.chess.fen(), this.o.human).map((t) => t.square as Square);
  }
  private kingSquare(c: Color): Square | null {
    for (const row of this.chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === c) return p.square;
    return null;
  }
  private refresh() {
    const hist = this.chess.history({ verbose: true });
    const ol = this.q('.movelist');
    ol.textContent = '';
    for (let i = 0; i < hist.length; i += 2) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="n">${i / 2 + 1}.</span><span>${hist[i]!.san}</span><span>${hist[i + 1]?.san ?? ''}</span>`;
      ol.append(li);
    }
    ol.scrollTop = ol.scrollHeight;
    const lost: string[] = [], won: string[] = [];
    let diff = 0;
    for (const m of hist) {
      if (!m.captured) continue;
      const mine = m.color === this.o.human;
      (mine ? won : lost).push(mini(m.captured as PieceType, mine ? (this.o.human === 'w' ? 'b' : 'w') : this.o.human));
      diff += (mine ? 1 : -1) * VALUE[m.captured]!;
    }
    this.q('.tray-opp').innerHTML = won.join('') + (diff > 0 ? `<span class="adv">+${diff}</span>` : '');
    this.q('.tray-you').innerHTML = lost.join('') + (diff < 0 ? `<span class="adv">+${-diff}</span>` : '');
    this.q('.turn').textContent = this.over ? 'Game over' : this.chess.turn() === this.o.human ? 'Your move' : 'Waiting';
    this.q('.status').textContent = !this.over && this.chess.turn() !== this.o.human ? 'Thinking…' : '';
    this.el.classList.toggle('your-turn', !this.over && this.chess.turn() === this.o.human);
    this.q<HTMLButtonElement>('[data-act=undo]').disabled = this.busy || this.over || this.chess.turn() !== this.o.human || hist.length < (this.o.human === 'w' ? 2 : 3);
  }
  private banner(text: string) {
    const b = this.q('.banner');
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  /* ---------- input ---------- */
  private onSquare(sq: Square) {
    if (this.busy || this.over || this.chess.turn() !== this.o.human || this.pending) return;
    if (this.selected) {
      const m = this.chess.moves({ square: this.selected, verbose: true }).filter((x) => x.to === sq);
      if (m.length) return void this.tryMove(this.selected, sq, m);
    }
    const p = this.chess.get(sq);
    this.hintMark = null;
    if (p && p.color === this.o.human && sq !== this.selected) {
      this.selected = sq;
      sfx('select', this.board.realm);
    } else this.selected = null;
    this.paint();
  }

  private tryMove(from: Square, to: Square, ms: Move[]) {
    if (ms[0]!.promotion) return this.pickPromotion(from, to);
    void this.confirmAndPlay({ from, to });
  }

  private pickPromotion(from: Square, to: Square) {
    const box = this.q('.promo');
    box.hidden = false;
    box.innerHTML = `<p>Promote your pawn to</p><div>${(['q', 'r', 'b', 'n'] as const).map((t) => `<button class="btn promo-btn" data-p="${t}" aria-label="${PIECE_NAMES[t]}">${mini(t, this.o.human)}<span>${PIECE_NAMES[t]}</span></button>`).join('')}</div>`;
    this.pending = { from, to };
    box.onclick = (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-p]')?.dataset.p;
      if (!t) return;
      box.hidden = true;
      this.pending = null;
      void this.confirmAndPlay({ from, to, promotion: t });
    };
  }

  private async confirmAndPlay(mv: { from: Square; to: Square; promotion?: string }) {
    if (this.o.coach) {
      const a = brain.assess(this.chess.fen(), mv.from + mv.to + (mv.promotion ?? ''));
      if (a.hangs) {
        sfx('warn', this.board.realm);
        const acts = this.q('.coach-actions');
        this.say(a.message);
        acts.hidden = false;
        acts.innerHTML = '<button class="btn" data-w="go">Move anyway</button><button class="btn ghost" data-w="no">Pick another</button>';
        acts.onclick = (e) => {
          const w = (e.target as HTMLElement).closest<HTMLElement>('[data-w]')?.dataset.w;
          if (!w) return;
          acts.hidden = true;
          if (w === 'go') void this.commit(mv);
          else this.say('Good call. Take your time.');
        };
        return;
      }
    }
    await this.commit(mv);
  }

  /* ---------- turns ---------- */
  private async commit(mv: { from: Square; to: Square; promotion?: string }) {
    this.busy = true;
    this.selected = null;
    this.hintMark = null;
    this.q('.coach-actions') && (this.q('.coach-actions').hidden = true);
    const m = this.chess.move(mv);
    this.board.mark({ last: [m.from, m.to] });
    this.refresh();
    await this.board.move(m);
    if (this.gone) return;
    await this.afterMove(m);
    if (this.gone || this.over) return;
    await this.opponentTurn();
  }

  private async afterMove(m: Move) {
    if (this.chess.isCheckmate()) return this.finish({ kind: 'mate', winner: m.color });
    if (this.chess.isStalemate()) return this.finish({ kind: 'stalemate' });
    if (this.chess.isDraw()) return this.finish({ kind: 'draw', why: this.chess.isInsufficientMaterial() ? 'Not enough pieces left to checkmate.' : this.chess.isThreefoldRepetition() ? 'The same position happened three times.' : 'Fifty moves passed with no capture or pawn move.' });
    if (this.chess.inCheck()) {
      const k = this.kingSquare(this.chess.turn())!;
      sfx('check', this.board.realm);
      this.banner('Check!');
      void this.board.flinch(k);
    }
    this.busy = false;
    this.paint();
    this.refresh();
  }

  private async opponentTurn() {
    this.busy = true;
    this.refresh();
    const t0 = performance.now();
    const fen = this.chess.fen();
    let uci: string;
    try {
      uci = await brain.opponentMove(fen, this.o.level);
    } catch {
      this.say('My opponent got lost thinking. Making a safe move for them.');
      const ms = this.chess.moves({ verbose: true });
      const m = ms[(Math.random() * ms.length) | 0]!;
      uci = m.from + m.to + (m.promotion ?? '');
    }
    const wait = 650 - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (this.gone) return;
    const m = this.chess.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] });
    this.board.mark({ last: [m.from, m.to] });
    await this.board.move(m);
    if (this.gone) return;
    this.refresh();
    await this.afterMove(m);
    if (this.over) return;
    this.coachAfterOpponent(m);
  }

  private coachAfterOpponent(m: Move) {
    if (!this.o.coach) return;
    const th = brain.threats(this.chess.fen(), this.o.human);
    const lead = m.captured ? `They took your ${pname(m.captured)}. ` : '';
    if (th.length) this.say(`${lead}Careful: ${th[0]!.message}`);
    else if (m.captured) this.say(`${lead}You can trade back if one of your pieces can reach that square.`);
    else {
      const n = this.chess.history().length;
      this.say(n < 12 ? TIPS[Math.floor(n / 2) % TIPS.length]! : 'Nothing of yours is in danger right now. Look for a piece you can attack.');
    }
  }

  /* ---------- actions ---------- */
  private async undo() {
    if (this.busy || this.over || this.chess.turn() !== this.o.human) return;
    this.chess.undo();
    this.chess.undo();
    this.selected = null;
    this.hintMark = null;
    this.board.setPosition(this.chess.fen());
    this.paint();
    this.refresh();
    this.say('Rewound. Nobody saw that.');
  }

  private async hint() {
    if (this.busy || this.over || this.chess.turn() !== this.o.human) return;
    this.q('.status').textContent = 'Pip is thinking…';
    let h: { uci: string; text: string };
    try {
      h = await brain.hint(this.chess.fen());
    } catch {
      this.say('I could not find a hint just now. Try looking for a capture or a piece to develop.');
      this.refresh();
      return;
    }
    if (this.gone) return;
    this.hintMark = [h.uci.slice(0, 2) as Square, h.uci.slice(2, 4) as Square];
    this.selected = null;
    this.paint();
    this.say(h.text);
    this.refresh();
  }

  private resign() {
    if (this.over) return;
    if (confirm('Resign this game?')) this.finish({ kind: 'resign', winner: this.o.human === 'w' ? 'b' : 'w' });
  }

  private async finish(end: End) {
    this.over = true;
    this.busy = true;
    this.selected = null;
    this.paint({ danger: [] });
    this.refresh();
    const won = end.winner === this.o.human;
    progress.games++;
    if (won) progress.wins++;
    saveProgress();
    if (end.kind === 'mate') {
      this.banner('Checkmate!');
      await this.board.checkmate(end.winner === 'w' ? 'b' : 'w');
    }
    if (this.gone) return;
    sfx(won ? 'win' : end.kind === 'mate' || end.kind === 'resign' ? 'lose' : 'check', this.board.realm);
    if (won) popText('Victory!', { x: innerWidth / 2, y: innerHeight * 0.4 }, this.board.realm === 'anime' ? 'anime' : this.board.realm === 'cyberpunk' ? 'cyber' : this.board.realm === 'medieval' ? 'medieval' : '');
    const lv = LEVELS_UI[this.o.level - 1]!;
    const title = end.kind === 'mate' ? (won ? 'Checkmate. You win!' : 'Checkmate. They win.') : end.kind === 'resign' ? 'You resigned' : end.kind === 'stalemate' ? 'Stalemate: a draw' : 'A draw';
    const body =
      end.kind === 'mate' && won ? `You beat ${lv.name} in ${Math.ceil(this.chess.history().length / 2)} moves.${this.o.level < 8 ? ' Ready for the next level?' : ''}`
      : end.kind === 'mate' ? `${lv.name} got you this time. Take a move back next game and look for what they threatened.`
      : end.kind === 'stalemate' ? 'The player to move had no legal move but was not in check, so nobody wins.'
      : end.kind === 'draw' ? end.why ?? ''
      : 'Every strong player has resigned a game. Set it up again whenever you like.';
    const r = this.q('.result');
    r.hidden = false;
    r.innerHTML = `<div class="result-card"><h2>${title}</h2><p>${body}</p><div class="row">
      <button class="btn" data-r="again">Play again</button>
      ${won && this.o.level < 8 ? '<button class="btn" data-r="next">Next level</button>' : ''}
      <button class="btn ghost" data-r="setup">Change setup</button><button class="btn ghost" data-r="home">Home</button></div></div>`;
    r.onclick = (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-r]')?.dataset.r;
      if (k === 'again') this.restart(this.o.level);
      if (k === 'next') this.restart(this.o.level + 1);
      if (k === 'setup') this.onExit('setup');
      if (k === 'home') this.onExit('home');
    };
    (r.querySelector('button') as HTMLElement | null)?.focus();
  }

  private restart(level: number) {
    settings.level = level;
    document.dispatchEvent(new CustomEvent('restart-game', { detail: { ...this.o, level } }));
  }
}
