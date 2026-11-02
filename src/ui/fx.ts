/** Full-viewport canvas for particles, lightning, slashes and speed lines. Runs only while something is alive. */
export type Pt = { x: number; y: number };

type Shape = 'shard' | 'spark' | 'square' | 'star' | 'puff' | 'ring' | 'splinter';
interface P {
  x: number; y: number; vx: number; vy: number; g: number; drag: number;
  life: number; max: number; size: number; rot: number; vr: number;
  color: string; shape: Shape; grow: number; glow: number;
}
interface Line { pts: Pt[]; life: number; max: number; color: string; width: number; glow: string }
interface Slash { a: Pt; b: Pt; life: number; max: number; color: string; width: number }
interface Rays { c: Pt; life: number; max: number; color: string; n: number; r0: number; r1: number }

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

class FX {
  private cv = document.createElement('canvas');
  private ctx = this.cv.getContext('2d')!;
  private ps: P[] = [];
  private lines: Line[] = [];
  private slashes: Slash[] = [];
  private rays: Rays[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;
  enabled = true;

  constructor() {
    this.cv.className = 'fx-canvas';
    this.cv.setAttribute('aria-hidden', 'true');
    addEventListener('resize', () => this.resize());
  }

  mount() {
    if (!this.cv.isConnected) {
      document.body.append(this.cv);
      this.resize();
    }
  }

  private resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.cv.width = innerWidth * this.dpr;
    this.cv.height = innerHeight * this.dpr;
  }

  private on() {
    return this.enabled && !reduced();
  }

  private kick() {
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.tick(t));
    }
  }

  emit(n: number, at: Pt, o: Pick<Partial<P>, 'g' | 'drag' | 'grow' | 'glow'> & { spread?: number; speed?: [number, number]; colors: string[]; shape: Shape; life?: [number, number]; size?: [number, number]; angle?: number }) {
    if (!this.on()) return;
    const [s0, s1] = o.speed ?? [60, 260];
    const [l0, l1] = o.life ?? [0.5, 1.1];
    const [z0, z1] = o.size ?? [4, 10];
    const spread = o.spread ?? Math.PI * 2;
    const base = o.angle ?? -Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      const s = s0 + Math.random() * (s1 - s0);
      const life = l0 + Math.random() * (l1 - l0);
      this.ps.push({
        x: at.x + (Math.random() - 0.5) * 10, y: at.y + (Math.random() - 0.5) * 10,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        g: o.g ?? 520, drag: o.drag ?? 0.4, life, max: life,
        size: z0 + Math.random() * (z1 - z0), rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12,
        color: o.colors[(Math.random() * o.colors.length) | 0]!, shape: o.shape, grow: o.grow ?? 0, glow: o.glow ?? 0,
      });
    }
    this.kick();
  }

  bolt(a: Pt, b: Pt, color: string, glow: string, life = 0.28) {
    if (!this.on()) return;
    const n = 9;
    const pts: Pt[] = [];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 38;
      pts.push({ x: a.x + dx * t + nx * j, y: a.y + dy * t + ny * j });
    }
    this.lines.push({ pts, life, max: life, color, width: 3.2, glow });
    this.kick();
  }

  slash(a: Pt, b: Pt, color: string, life = 0.22, width = 10) {
    if (!this.on()) return;
    this.slashes.push({ a, b, life, max: life, color, width });
    this.kick();
  }

  speedLines(c: Pt, color: string, life = 0.35) {
    if (!this.on()) return;
    this.rays.push({ c, life, max: life, color, n: 18, r0: 70, r1: Math.max(innerWidth, innerHeight) });
    this.kick();
  }

  private tick(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    for (const r of this.rays) {
      r.life -= dt;
      const k = Math.max(0, r.life / r.max);
      ctx.save();
      ctx.globalAlpha = k * 0.55;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < r.n; i++) {
        const a = (i / r.n) * 6.283 + (i % 3) * 0.05;
        const in0 = r.r0 + (1 - k) * 120 + (i % 4) * 30;
        ctx.beginPath();
        ctx.moveTo(r.c.x + Math.cos(a) * in0, r.c.y + Math.sin(a) * in0);
        ctx.lineTo(r.c.x + Math.cos(a) * (in0 + 90 + (i % 5) * 40), r.c.y + Math.sin(a) * (in0 + 90 + (i % 5) * 40));
        ctx.stroke();
      }
      ctx.restore();
    }
    this.rays = this.rays.filter((r) => r.life > 0);

    for (const s of this.slashes) {
      s.life -= dt;
      const k = Math.max(0, s.life / s.max);
      const p = Math.min(1, (1 - k) * 3);
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.strokeStyle = s.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = s.width * (0.4 + k);
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.a.x + (s.b.x - s.a.x) * p, s.a.y + (s.b.y - s.a.y) * p);
      ctx.stroke();
      ctx.restore();
    }
    this.slashes = this.slashes.filter((s) => s.life > 0);

    for (const l of this.lines) {
      l.life -= dt;
      const k = Math.max(0, l.life / l.max);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.lineJoin = 'round';
      ctx.shadowColor = l.glow;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = l.glow;
      ctx.lineWidth = l.width * 3;
      ctx.beginPath();
      l.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width;
      ctx.stroke();
      ctx.restore();
    }
    this.lines = this.lines.filter((l) => l.life > 0);

    for (const p of this.ps) {
      p.life -= dt;
      p.vy += p.g * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const k = Math.max(0, p.life / p.max);
      const sz = p.size * (1 + p.grow * (1 - k));
      ctx.save();
      ctx.globalAlpha = p.shape === 'puff' ? k * 0.55 : Math.min(1, k * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = p.glow; }
      switch (p.shape) {
        case 'shard':
          ctx.beginPath(); ctx.moveTo(-sz, sz * 0.5); ctx.lineTo(sz * 0.2, -sz); ctx.lineTo(sz, sz * 0.6); ctx.closePath(); ctx.fill(); break;
        case 'splinter':
          ctx.fillRect(-sz, -sz * 0.18, sz * 2, sz * 0.36); break;
        case 'square':
          ctx.fillRect(-sz / 2, -sz / 2, sz, sz); break;
        case 'spark':
          ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.lineTo(sz, 0); ctx.stroke(); break;
        case 'puff':
          ctx.beginPath(); ctx.arc(0, 0, sz, 0, 6.283); ctx.fill(); break;
        case 'ring':
          ctx.lineWidth = 3 * k + 1; ctx.beginPath(); ctx.arc(0, 0, sz, 0, 6.283); ctx.stroke(); break;
        case 'star': {
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const r = i % 2 ? sz * 0.28 : sz; const a = (i / 8) * 6.283; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill(); break;
        }
      }
      ctx.restore();
    }
    this.ps = this.ps.filter((p) => p.life > 0);

    if (this.ps.length || this.lines.length || this.slashes.length || this.rays.length) {
      this.raf = requestAnimationFrame((t) => this.tick(t));
    } else {
      this.raf = 0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }
}

export const fx = new FX();

/** Floating comic-style word at a screen point (DOM, so it uses the realm font). */
export function popText(text: string, at: Pt, cls = '') {
  if (reduced()) return;
  const el = document.createElement('div');
  el.className = `pop-text ${cls}`;
  el.textContent = text;
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;
  document.body.append(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}
