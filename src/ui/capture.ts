/**
 * Capture choreography. Every realm shares the same beats (wind-up, lunge, impact, death, step in)
 * but plays its own impact and death, so a capture feels like a different fight in each world.
 */
import type { Square } from 'chess.js';
import type { Board, PieceRec } from './board';
import { play as sfx, type Realm } from './audio';
import { fx, popText, type Pt } from './fx';

interface Ctx {
  b: Board;
  att: PieceRec;
  vic: PieceRec;
  a: Pt;
  v: Pt;
  vFeet: Pt;
  ux: number;
  uy: number;
  body: string;
  trim: string;
}
interface Style {
  windup: number;
  lunge: number;
  impact(c: Ctx): void | Promise<void>;
  death(c: Ctx): Promise<void>;
}

const css = (el: HTMLElement, v: string) => getComputedStyle(el).getPropertyValue(v).trim();
const art = (r: PieceRec) => r.face.firstElementChild as HTMLElement;
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function flash(color: string, ms = 220, peak = 0.85) {
  const d = document.createElement('div');
  d.className = 'flash';
  d.style.background = color;
  document.body.append(d);
  d.animate([{ opacity: peak }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }).finished.then(() => d.remove());
}

const STYLES: Record<Realm, Style> = {
  enchanted: {
    windup: 230,
    lunge: 120,
    impact(c) {
      sfx('capture', 'enchanted');
      fx.bolt(c.a, c.v, '#ffffff', css(c.att.el, '--trim') || '#e8b64c');
      fx.emit(1, c.v, { colors: [c.trim], shape: 'ring', speed: [0, 0], size: [16, 16], grow: 5, life: [0.45, 0.45], g: 0, drag: 0 });
      flash('rgba(166,139,255,.35)', 260, 0.7);
      c.b.shakeStage(7);
    },
    async death(c) {
      const a = art(c.vic);
      await c.b.anim(a, [{ filter: 'none' }, { filter: 'grayscale(1) brightness(1.7) contrast(1.15)', transform: 'translateX(-2px)' }, { filter: 'grayscale(1) brightness(1.7) contrast(1.15)', transform: 'translateX(2px)' }, { filter: 'grayscale(1) brightness(2.2)', transform: 'translateX(0) scale(1.05)' }], 320, { easing: 'steps(6)' });
      fx.emit(34, c.v, { colors: [c.body, '#8b8499', '#d6d0e4'], shape: 'shard', speed: [120, 380], size: [5, 12], g: 900, life: [0.7, 1.2] });
      fx.emit(18, c.v, { colors: ['#ffffff', c.trim, '#a68bff'], shape: 'star', speed: [60, 260], size: [4, 10], g: 80, glow: 14, life: [0.6, 1] });
      await c.b.anim(c.vic.hop, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0.6, offset: 0.3 }, { transform: 'scale(0)', opacity: 0 }], 200, { easing: 'ease-in' });
      await c.b.wait(180);
    },
  },
  medieval: {
    windup: 190,
    lunge: 110,
    impact(c) {
      sfx('capture', 'medieval');
      const m = mid(c.a, c.v);
      fx.emit(22, m, { colors: ['#ffd27a', '#ffb347', '#fff1c4'], shape: 'spark', speed: [160, 520], size: [5, 12], g: 600, life: [0.25, 0.6], glow: 8 });
      fx.emit(1, m, { colors: ['#fff1c4'], shape: 'ring', speed: [0, 0], size: [8, 8], grow: 4, life: [0.25, 0.25], g: 0, drag: 0 });
      popText('CLANG!', { x: m.x, y: m.y - 50 }, 'medieval');
      c.b.shakeStage(9);
    },
    async death(c) {
      const side = c.ux === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(c.ux);
      const a = c.vic.hop;
      await c.b.anim(a, [{ transform: 'rotate(0)', transformOrigin: '50% 93%' }, { transform: `rotate(${-side * 8}deg)`, offset: 0.2, transformOrigin: '50% 93%' }, { transform: `rotate(${side * 82}deg) translateY(6px)`, transformOrigin: '50% 93%' }], 520, { easing: 'cubic-bezier(.55,0,.9,.5)' });
      fx.emit(12, c.vFeet, { colors: ['#8a7456', '#a8946f', '#6b5a41'], shape: 'puff', speed: [30, 140], spread: Math.PI, size: [8, 18], g: -30, grow: 1.4, life: [0.5, 0.9] });
      fx.emit(10, c.vFeet, { colors: ['#7a5430', '#5a3d22'], shape: 'splinter', speed: [100, 300], size: [5, 10], g: 900, life: [0.5, 0.9] });
      c.b.shakeStage(4, 180);
      await c.b.anim(a, [{ opacity: 1 }, { opacity: 0 }], 260, { easing: 'ease-out', delay: 120 });
    },
  },
  cyberpunk: {
    windup: 170,
    lunge: 80,
    impact(c) {
      sfx('capture', 'cyberpunk');
      fx.slash({ x: c.v.x - 90, y: c.v.y }, { x: c.v.x + 90, y: c.v.y }, '#19f3ff', 0.2, 6);
      fx.emit(14, c.v, { colors: ['#19f3ff', '#ff35d1', '#ffffff'], shape: 'square', speed: [100, 400], size: [3, 8], g: 300, life: [0.3, 0.7], glow: 10 });
      popText('DELETED', { x: c.v.x, y: c.v.y - 60 }, 'cyber');
      c.b.shakeStage(5, 200);
    },
    async death(c) {
      const f = c.vic.face;
      const slices = [
        { clipPath: 'inset(0 0 0 0)', transform: 'translateX(0)', filter: 'none' },
        { clipPath: 'inset(0 0 62% 0)', transform: 'translateX(-14px)', filter: 'hue-rotate(90deg) saturate(3)' },
        { clipPath: 'inset(30% 0 30% 0)', transform: 'translateX(16px)', filter: 'hue-rotate(-60deg) brightness(2)' },
        { clipPath: 'inset(58% 0 0 0)', transform: 'translateX(-10px)', filter: 'saturate(4)' },
        { clipPath: 'inset(10% 0 40% 0)', transform: 'translateX(9px) skewX(20deg)', filter: 'hue-rotate(160deg) brightness(2.4)' },
        { clipPath: 'inset(0 0 0 0)', transform: 'translateX(-5px)', filter: 'brightness(3)', opacity: 0.5 },
      ];
      await c.b.anim(f, slices, 380, { easing: 'steps(1, end)' });
      const r = f.getBoundingClientRect();
      for (let i = 0; i < 40; i++) {
        const p = { x: r.left + Math.random() * r.width, y: r.top + Math.random() * r.height * 0.85 };
        fx.emit(1, p, { colors: [c.trim, '#19f3ff', '#ff35d1', '#ffffff'], shape: 'square', speed: [10, 90], spread: Math.PI * 0.6, angle: Math.PI / 2, size: [3, 8], g: 260, life: [0.5, 1.1], glow: 8 });
      }
      f.style.visibility = 'hidden';
      await c.b.wait(260);
    },
  },
  anime: {
    windup: 280,
    lunge: 90,
    async impact(c) {
      await c.b.wait(70); // hit-stop
      sfx('capture', 'anime');
      fx.speedLines(c.v, '#1c1233');
      fx.slash({ x: c.v.x - 120, y: c.v.y - 90 }, { x: c.v.x + 120, y: c.v.y + 90 }, '#ffffff', 0.25, 14);
      flash('#ffffff', 200, 0.9);
      popText('KO!', { x: c.v.x, y: c.v.y - 70 }, 'anime');
      c.b.shakeStage(12, 320);
    },
    async death(c) {
      const dir = c.ux >= 0 ? 1 : -1;
      await c.b.anim(c.vic.hop, [
        { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
        { transform: `translate(${dir * -8}px, 6px) rotate(${dir * -12}deg) scale(1.1,.9)`, offset: 0.14 },
        { transform: `translate(${dir * c.b.sq * 2.2}px, ${-c.b.sq * 3.4}px) rotate(${dir * 900}deg) scale(.35)`, opacity: 0.9, offset: 0.9 },
        { transform: `translate(${dir * c.b.sq * 2.6}px, ${-c.b.sq * 3.8}px) rotate(${dir * 960}deg) scale(0)`, opacity: 0 },
      ], 760, { easing: 'cubic-bezier(.2,.7,.3,1)' });
      const sky = { x: c.v.x + dir * c.b.sq * 2.2, y: c.v.y - c.b.sq * 3.4 };
      fx.emit(14, sky, { colors: ['#ffffff', '#ff4d8d', '#ffd35c'], shape: 'star', speed: [40, 200], size: [6, 14], g: 60, life: [0.5, 0.9] });
    },
  },
};

export async function captureSequence(b: Board, att: PieceRec, vic: PieceRec, stop: Square) {
  const s = STYLES[b.realm];
  const base = b.pos(stop);
  const vp = b.pos(vic.sq);
  const dx = vp.x - base.x, dy = vp.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const aEl = art(att);

  await b.anim(aEl, [{ transform: 'rotate(0) scale(1)' }, { transform: `rotate(${-Math.sign(ux || 1) * 9}deg) scale(1.06,.92)` }], s.windup, { easing: 'cubic-bezier(.3,0,.3,1)' });
  const out = { x: base.x + ux * b.sq * 0.5, y: base.y + uy * b.sq * 0.5 };
  const tr = (p: Pt) => `translate(${p.x}px, ${p.y}px)`;
  await b.anim(att.el, [{ transform: tr(base) }, { transform: tr(out) }], s.lunge, { easing: 'cubic-bezier(.6,0,1,.5)' }, () => (att.el.style.transform = tr(out)));
  aEl.style.transform = '';

  const at = b.screenOf(att), vt = b.screenOf(vic);
  const ctx: Ctx = {
    b, att, vic, a: at.body, v: vt.body, vFeet: vt.feet, ux, uy,
    body: css(vic.el, '--body') || '#ccc', trim: css(vic.el, '--trim') || '#fff',
  };
  await s.impact(ctx);
  const back = b.anim(att.el, [{ transform: tr(out) }, { transform: tr(base) }], 240, { easing: 'cubic-bezier(.2,.7,.3,1)' }, () => (att.el.style.transform = tr(base)));
  await Promise.all([s.death(ctx), back]);
}
