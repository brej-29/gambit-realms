import { Chess, type Move, type Square } from 'chess.js';
import { pieceSvg, PIECE_NAMES, type PieceType } from './pieces';
import { play as sfx, type Realm } from './audio';
import { captureSequence } from './capture';
import { fx, type Pt } from './fx';

export type Color = 'w' | 'b';
export interface PieceRec {
  type: PieceType;
  color: Color;
  sq: Square;
  el: HTMLElement;
  rig: HTMLElement;
  hop: HTMLElement;
  face: HTMLElement;
  dir: 1 | -1;
}
export interface Marks {
  selected?: Square | null;
  targets?: { sq: Square; capture: boolean }[];
  last?: [Square, Square] | null;
  danger?: Square[];
  check?: Square | null;
  hint?: [Square, Square] | null;
}
export interface BoardOptions {
  orientation?: Color;
  interactive?: boolean;
  onSquare?: (sq: Square) => void;
}

const FILES = 'abcdefgh';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Board {
  readonly root = document.createElement('div');
  /** 1 = normal, <1 faster, 0 = instant. */
  speed = 1;
  orientation: Color;
  private sqEls = new Map<Square, HTMLButtonElement>();
  private grid = document.createElement('div');
  private layer = document.createElement('div');
  private pieces = new Map<Square, PieceRec>();
  private size = 64;
  private ro: ResizeObserver;
  private focused: Square = 'e2';
  private live = document.createElement('div');
  private marks: Marks = {};

  constructor(private opts: BoardOptions = {}) {
    this.orientation = opts.orientation ?? 'w';
    this.root.className = 'board-wrap';
    this.root.innerHTML = `<div class="stage"><div class="tilt"><div class="slab"></div><div class="rim"></div></div></div>`;
    const tilt = this.root.querySelector('.tilt')!;
    this.grid.className = 'grid';
    this.grid.setAttribute('role', 'grid');
    this.grid.setAttribute('aria-label', 'Chess board');
    this.layer.className = 'pieces';
    tilt.append(this.grid, this.layer);
    this.live.className = 'sr-only';
    this.live.setAttribute('aria-live', 'polite');
    this.root.append(this.live);
    this.buildSquares();
    this.ro = new ResizeObserver(() => this.relayout());
    this.ro.observe(this.root);
  }

  get realm(): Realm {
    return (document.documentElement.dataset.realm as Realm) ?? 'enchanted';
  }
  get sq() {
    return this.size;
  }
  T(ms: number) {
    return reducedMotion() ? 0 : ms * this.speed;
  }
  destroy() {
    this.ro.disconnect();
    this.root.remove();
  }

  /* ---------- geometry ---------- */
  private relayout() {
    const w = this.root.clientWidth;
    if (!w) return;
    this.size = w / 8;
    this.root.style.setProperty('--sq', `${this.size}px`);
    for (const rec of this.pieces.values()) this.place(rec);
  }
  /** Top-left of a square, in board pixels. */
  pos(sq: Square): Pt {
    const f = FILES.indexOf(sq[0]!);
    const r = Number(sq[1]) - 1;
    const col = this.orientation === 'w' ? f : 7 - f;
    const row = this.orientation === 'w' ? 7 - r : r;
    return { x: col * this.size, y: row * this.size };
  }
  private tr(p: Pt, extra = '') {
    return `translate(${p.x}px, ${p.y}px) ${extra}`;
  }
  private place(rec: PieceRec) {
    rec.el.style.transform = this.tr(this.pos(rec.sq));
    rec.el.dataset.sq = rec.sq;
  }
  /** Screen position of a piece's body centre and of its feet. */
  screenOf(rec: PieceRec): { body: Pt; feet: Pt } {
    const r = rec.rig.getBoundingClientRect();
    return { body: { x: r.left + r.width / 2, y: r.top + r.height * 0.58 }, feet: { x: r.left + r.width / 2, y: r.bottom - r.height * 0.07 } };
  }
  screenOfSquare(sq: Square): Pt {
    const r = this.sqEls.get(sq)!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* ---------- squares ---------- */
  private buildSquares() {
    this.grid.textContent = '';
    this.sqEls.clear();
    for (let row = 0; row < 8; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'row8';
      rowEl.setAttribute('role', 'row');
      this.grid.append(rowEl);
      for (let col = 0; col < 8; col++) {
        const f = this.orientation === 'w' ? col : 7 - col;
        const r = this.orientation === 'w' ? 7 - row : row;
        const name = `${FILES[f]}${r + 1}` as Square;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `sq ${(f + r) % 2 ? 'light' : 'dark'}`;
        b.dataset.sq = name;
        b.tabIndex = name === this.focused ? 0 : -1;
        b.setAttribute('role', 'gridcell');
        b.innerHTML = '<span class="mk"></span>';
        if (col === 0) b.insertAdjacentHTML('beforeend', `<span class="co rank">${r + 1}</span>`);
        if (row === 7) b.insertAdjacentHTML('beforeend', `<span class="co file">${FILES[f]}</span>`);
        b.addEventListener('click', () => {
          this.focused = name;
          this.opts.onSquare?.(name);
        });
        b.addEventListener('keydown', (e) => this.onKey(e, name));
        rowEl.append(b);
        this.sqEls.set(name, b);
      }
    }
    this.root.classList.toggle('interactive', this.opts.interactive !== false);
    this.applyMarks();
  }
  private onKey(e: KeyboardEvent, from: Square) {
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    const flip = this.orientation === 'w' ? 1 : -1;
    const f = FILES.indexOf(from[0]!) + m[0] * flip;
    const r = Number(from[1]) - 1 + m[1] * flip;
    if (f < 0 || f > 7 || r < 0 || r > 7) return;
    this.focusSquare(`${FILES[f]}${r + 1}` as Square);
  }
  focusSquare(sq: Square) {
    this.sqEls.get(this.focused)?.setAttribute('tabindex', '-1');
    this.focused = sq;
    const el = this.sqEls.get(sq)!;
    el.tabIndex = 0;
    el.focus();
  }
  setOrientation(c: Color) {
    if (c === this.orientation) return;
    this.orientation = c;
    this.buildSquares();
    this.relayout();
  }
  announce(text: string) {
    this.live.textContent = text;
  }
  private label(sq: Square) {
    const p = this.pieces.get(sq);
    const el = this.sqEls.get(sq)!;
    el.setAttribute('aria-label', p ? `${sq}, ${p.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[p.type]}` : `${sq}, empty`);
  }

  /* ---------- pieces ---------- */
  private make(type: PieceType, color: Color, sq: Square): PieceRec {
    const el = document.createElement('div');
    el.className = `piece ${color === 'w' ? 'w' : 'bk'} t-${type}`;
    el.style.setProperty('--d', `${Math.random().toFixed(2)}`);
    el.innerHTML =
      `<div class="floor"></div><div class="ring"></div><div class="rig"><div class="hop"><div class="face">${pieceSvg(type)}</div></div></div>`;
    const rec: PieceRec = {
      type, color, sq, el,
      rig: el.querySelector('.rig')!, hop: el.querySelector('.hop')!, face: el.querySelector('.face')!,
      dir: color === 'w' ? 1 : -1,
    };
    this.setFace(rec, rec.dir);
    el.addEventListener('click', (e) => {
      // A tall piece in front can cover the square behind it. If a legal target lies under the pointer, the player meant that square.
      const under = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.classList.contains('sq'))?.getAttribute('data-sq') as Square | undefined;
      const targets = this.marks.targets ?? [];
      const sq = under && targets.some((t) => t.sq === under) && !targets.some((t) => t.sq === rec.sq) ? under : rec.sq;
      this.focused = sq;
      this.opts.onSquare?.(sq);
    });
    this.layer.append(el);
    this.place(rec);
    return rec;
  }
  private setFace(rec: PieceRec, dir: 1 | -1) {
    rec.dir = dir;
    rec.face.style.transform = rec.type === 'n' ? `scaleX(${dir})` : '';
  }
  at(sq: Square) {
    return this.pieces.get(sq);
  }
  /** Instant (re)build from a FEN, no animation. */
  setPosition(fen: string) {
    for (const rec of this.pieces.values()) rec.el.remove();
    this.pieces.clear();
    const chess = new Chess(fen);
    for (const row of chess.board())
      for (const c of row) if (c) this.pieces.set(c.square, this.make(c.type, c.color, c.square));
    for (const sq of this.sqEls.keys()) this.label(sq);
    this.relayout();
    this.mark({});
  }

  /* ---------- marks ---------- */
  mark(m: Marks) {
    this.marks = m;
    this.applyMarks();
  }
  private applyMarks() {
    const m = this.marks;
    for (const [sq, el] of this.sqEls) {
      el.classList.remove('sel', 'tgt', 'cap', 'last', 'chk', 'hint-from', 'hint-to');
      if (m.selected === sq) el.classList.add('sel');
      if (m.last?.includes(sq)) el.classList.add('last');
      if (m.check === sq) el.classList.add('chk');
      if (m.hint?.[0] === sq) el.classList.add('hint-from');
      if (m.hint?.[1] === sq) el.classList.add('hint-to');
    }
    for (const t of m.targets ?? []) this.sqEls.get(t.sq)?.classList.add(t.capture ? 'cap' : 'tgt');
    for (const [sq, rec] of this.pieces) rec.el.classList.toggle('danger', !!m.danger?.includes(sq));
  }

  /* ---------- animation helpers ---------- */
  async anim(el: HTMLElement, kf: Keyframe[], ms: number, o: KeyframeAnimationOptions = {}, commit?: () => void) {
    const d = this.T(ms);
    if (d <= 0) {
      commit?.();
      return;
    }
    const a = el.animate(kf, { duration: d, fill: 'both', easing: 'ease-in-out', ...o });
    await a.finished.catch(() => undefined);
    commit?.();
    a.cancel();
  }
  wait(ms: number) {
    const d = this.T(ms);
    return d <= 0 ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, d));
  }
  shakeStage(px = 8, ms = 260) {
    const s = this.root.querySelector<HTMLElement>('.stage')!;
    const k: Keyframe[] = [];
    for (let i = 0; i < 8; i++) k.push({ transform: `translate(${(Math.random() - 0.5) * px * (1 - i / 8) * 2}px, ${(Math.random() - 0.5) * px * (1 - i / 8)}px)` });
    k.push({ transform: 'none' });
    void this.anim(s, k, ms, { easing: 'linear' });
  }

  /** Walk a piece between two squares with hops and a lean. */
  async walk(rec: PieceRec, from: Square, to: Square, ms?: number) {
    const a = this.pos(from), b = this.pos(to);
    const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0)), dr = Math.abs(Number(from[1]) - Number(to[1]));
    const dist = Math.max(df, dr, 0.5);
    const knight = rec.type === 'n';
    const dur = ms ?? (knight ? 560 : 240 + 75 * Math.min(dist, 6));
    const dx = b.x - a.x;
    if (dx && rec.type === 'n') this.setFace(rec, dx > 0 ? 1 : -1);
    const lean = Math.sign(dx) * 7;
    const hops = knight ? 1 : Math.max(1, Math.min(4, Math.round(dist)));
    const h = knight ? this.size * 0.95 : this.size * 0.13;
    const hk: Keyframe[] = [];
    for (let i = 0; i < hops; i++) {
      hk.push({ offset: i / hops, transform: 'translateY(0) scale(1,1)' });
      hk.push({ offset: (i + 0.5) / hops, transform: `translateY(${-h}px) scale(${knight ? '1.08,1.08' : '1,1.04'})` });
    }
    hk.push({ offset: 1, transform: knight ? 'translateY(0) scale(1.1,0.88)' : 'translateY(0) scale(1.04,0.96)' });
    rec.el.style.zIndex = '5';
    await Promise.all([
      this.anim(rec.el, [{ transform: this.tr(a) }, { transform: this.tr(b) }], dur, { easing: 'cubic-bezier(.4,0,.2,1)' }, () => (rec.el.style.transform = this.tr(b))),
      this.anim(rec.hop, hk, dur, { easing: 'ease-in-out' }),
      this.anim(rec.face.firstElementChild as HTMLElement, [{ transform: 'rotate(0)' }, { transform: `rotate(${lean}deg)`, offset: 0.2 }, { transform: `rotate(${lean}deg)`, offset: 0.8 }, { transform: 'rotate(0)' }], dur, { easing: 'ease-in-out' }),
    ]);
    rec.el.style.zIndex = '';
  }

  private setSq(rec: PieceRec, sq: Square) {
    this.pieces.delete(rec.sq);
    rec.sq = sq;
    this.pieces.set(sq, rec);
    this.place(rec);
    this.label(rec.sq);
  }

  /** Square the attacker should stop on before striking, or its own square for a leap. */
  private approach(from: Square, to: Square, type: PieceType): Square {
    if (type === 'n') return from;
    const df = to.charCodeAt(0) - from.charCodeAt(0), dr = Number(to[1]) - Number(from[1]);
    const n = Math.max(Math.abs(df), Math.abs(dr));
    if (n <= 1) return from;
    const sf = Math.sign(df), sr = Math.sign(dr);
    return `${String.fromCharCode(to.charCodeAt(0) - sf)}${Number(to[1]) - sr}` as Square;
  }

  /** Play a chess.js move with full choreography. Resolves when everything has settled. */
  async move(m: Move): Promise<void> {
    const rec = this.pieces.get(m.from);
    if (!rec) {
      this.setPosition(m.after);
      return;
    }
    const realm = this.realm;
    this.mark({ last: [m.from, m.to] });
    fx.mount();
    const isEp = m.flags.includes('e');
    const vicSq = (isEp ? `${m.to[0]}${m.from[1]}` : m.to) as Square;
    const vic = m.captured ? this.pieces.get(vicSq) : undefined;

    if (vic) {
      const stop = this.approach(m.from, m.to, rec.type);
      if (stop !== m.from) await this.walk(rec, m.from, stop);
      this.pieces.delete(vicSq);
      await captureSequence(this, rec, vic, stop);
      vic.el.remove();
      rec.el.style.transform = this.tr(this.pos(stop));
      await this.walk(rec, stop, m.to, rec.type === 'n' ? 420 : 200);
      this.setSq(rec, m.to);
      this.landPuff(rec);
    } else {
      sfx('move', realm);
      await this.walk(rec, m.from, m.to);
      this.setSq(rec, m.to);
      this.landPuff(rec);
    }

    if (m.flags.includes('k') || m.flags.includes('q')) {
      // the king has already stepped; bring the rook across
      const rank = m.from[1];
      const [rf, rt] = m.flags.includes('k') ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`];
      const rook = this.pieces.get(rf as Square);
      if (rook) {
        await this.walk(rook, rf as Square, rt as Square, 360);
        this.setSq(rook, rt as Square);
        this.landPuff(rook);
      }
    }
    if (m.promotion) await this.promote(rec, m.promotion as PieceType);
    for (const sq of this.sqEls.keys()) this.label(sq);
    this.announce(`${m.color === 'w' ? 'White' : 'Black'} ${m.san}`);
  }

  private landPuff(rec: PieceRec) {
    const { feet } = this.screenOf(rec);
    const c = getComputedStyle(this.root).getPropertyValue('--puff').trim() || 'rgba(255,255,255,.5)';
    fx.emit(5, feet, { colors: [c], shape: 'puff', speed: [10, 50], spread: Math.PI, angle: -Math.PI / 2, size: [3, 6], life: [0.2, 0.4], g: -20, grow: 1.5 });
  }

  async promote(rec: PieceRec, to: PieceType) {
    sfx('promote', this.realm);
    const at = this.screenOf(rec).body;
    const c = getComputedStyle(rec.el).getPropertyValue('--trim').trim() || '#fff';
    fx.emit(26, at, { colors: [c, '#fff'], shape: 'star', speed: [80, 300], size: [5, 11], g: 120, glow: 12 });
    await this.anim(rec.hop, [{ transform: 'scale(1)' }, { transform: 'scale(.2,1.4)', filter: 'brightness(3)' }], 180);
    rec.type = to;
    rec.el.className = `piece ${rec.color === 'w' ? 'w' : 'bk'} t-${to}`;
    rec.face.innerHTML = pieceSvg(to);
    this.setFace(rec, rec.dir);
    await this.anim(rec.hop, [{ transform: 'scale(.2,1.4)', filter: 'brightness(3)' }, { transform: 'scale(1.2,.9)', filter: 'brightness(1.5)' }, { transform: 'scale(1)', filter: 'none' }], 340, { easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }

  /** Brief "eep" on a piece, used for check. */
  async flinch(sq: Square) {
    const rec = this.pieces.get(sq);
    if (!rec) return;
    const art = rec.face.firstElementChild as HTMLElement;
    await this.anim(art, [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px) rotate(-4deg)' }, { transform: 'translateX(5px) rotate(4deg)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], 360, { easing: 'linear' });
  }

  /** The defeated king topples; the winner's pieces bounce in a wave. */
  async checkmate(loser: Color) {
    const king = [...this.pieces.values()].find((p) => p.type === 'k' && p.color === loser);
    const winners = [...this.pieces.values()].filter((p) => p.color !== loser);
    if (king) {
      const at = this.screenOf(king).body;
      fx.emit(20, at, { colors: [getComputedStyle(king.el).getPropertyValue('--trim').trim() || '#fff'], shape: 'star', speed: [60, 220], g: 400, size: [4, 9], glow: 10 });
      void this.anim(king.hop, [{ transform: 'rotate(0)' }, { transform: 'rotate(-14deg)', offset: 0.3 }, { transform: 'translateY(8px) rotate(-92deg)' }], 900, { easing: 'cubic-bezier(.5,0,.8,.4)' });
    }
    winners.sort((a, b) => a.sq.localeCompare(b.sq));
    winners.forEach((p, i) => {
      setTimeout(() => this.anim(p.hop, [{ transform: 'translateY(0)' }, { transform: `translateY(${-this.size * 0.4}px) scale(1.05)` }, { transform: 'translateY(0)' }], 520, { easing: 'cubic-bezier(.3,.7,.4,1)' }), this.T(260 + i * 55));
    });
    await this.wait(1100);
  }
}
