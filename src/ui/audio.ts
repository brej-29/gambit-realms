/** Tiny WebAudio synth: no audio files, so nothing to download and each realm gets its own timbre. */
export type Realm = 'enchanted' | 'medieval' | 'cyberpunk' | 'anime';
export type Sfx = 'select' | 'move' | 'capture' | 'check' | 'win' | 'lose' | 'warn' | 'promote';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
export const audio = { muted: false, volume: 0.5 };

function ctx(): AudioContext | null {
  if (audio.muted) return null;
  try {
    if (!ac) {
      ac = new AudioContext();
      master = ac.createGain();
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') void ac.resume();
    master!.gain.value = audio.volume * 0.6;
    return ac;
  } catch {
    return null;
  }
}

function noise(c: AudioContext, dur: number) {
  const buf = c.createBuffer(1, Math.max(1, (c.sampleRate * dur) | 0), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = buf;
  return s;
}

function tone(c: AudioContext, o: { f: number; f2?: number; t?: OscillatorType; dur: number; vol?: number; at?: number }) {
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.t ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(master!);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

function thud(c: AudioContext, f: number, dur = 0.12, vol = 0.5) {
  tone(c, { f, f2: f * 0.45, t: 'sine', dur, vol });
  const n = noise(c, dur);
  const flt = c.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = f * 6;
  const g = c.createGain();
  g.gain.setValueAtTime(vol * 0.5, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  n.connect(flt).connect(g).connect(master!);
  n.start();
}

function sweepNoise(c: AudioContext, f0: number, f1: number, dur: number, vol = 0.3, q = 2) {
  const n = noise(c, dur);
  const flt = c.createBiquadFilter();
  flt.type = 'bandpass';
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, c.currentTime);
  flt.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  n.connect(flt).connect(g).connect(master!);
  n.start();
}

const notes = { c5: 523, e5: 659, g5: 784, c6: 1047, e6: 1319, a4: 440, d5: 587 };

export function play(kind: Sfx, realm: Realm) {
  const c = ctx();
  if (!c) return;
  switch (kind) {
    case 'select':
      tone(c, { f: realm === 'cyberpunk' ? 880 : 620, f2: realm === 'cyberpunk' ? 1320 : 760, t: realm === 'cyberpunk' ? 'square' : 'triangle', dur: 0.07, vol: 0.12 });
      break;
    case 'move':
      thud(c, realm === 'cyberpunk' ? 220 : realm === 'anime' ? 330 : 170, 0.1, 0.35);
      if (realm === 'enchanted') tone(c, { f: 1200, f2: 1800, dur: 0.18, vol: 0.05, at: 0.02 });
      break;
    case 'capture':
      if (realm === 'enchanted') {
        sweepNoise(c, 4000, 300, 0.25, 0.35, 1);
        tone(c, { f: 1400, f2: 90, t: 'sawtooth', dur: 0.3, vol: 0.2 });
        [notes.g5, notes.c6, notes.e6].forEach((f, i) => tone(c, { f, dur: 0.5, vol: 0.09, at: 0.18 + i * 0.07 }));
      } else if (realm === 'medieval') {
        [820, 1230, 1790].forEach((f) => tone(c, { f, t: 'square', dur: 0.22, vol: 0.07 }));
        thud(c, 120, 0.25, 0.6);
        sweepNoise(c, 1200, 200, 0.4, 0.18, 0.7);
      } else if (realm === 'cyberpunk') {
        for (let i = 0; i < 6; i++) tone(c, { f: 200 + Math.random() * 1800, t: 'square', dur: 0.05, vol: 0.12, at: i * 0.035 });
        tone(c, { f: 900, f2: 60, t: 'sawtooth', dur: 0.4, vol: 0.18, at: 0.1 });
      } else {
        sweepNoise(c, 600, 6000, 0.12, 0.4, 1.2);
        thud(c, 90, 0.3, 0.7);
        tone(c, { f: notes.e6, dur: 0.35, vol: 0.12, at: 0.2 });
      }
      break;
    case 'check':
      tone(c, { f: notes.a4, t: 'triangle', dur: 0.12, vol: 0.2 });
      tone(c, { f: notes.d5, t: 'triangle', dur: 0.2, vol: 0.2, at: 0.1 });
      break;
    case 'warn':
      tone(c, { f: 300, f2: 220, t: 'square', dur: 0.16, vol: 0.1 });
      break;
    case 'promote':
      [notes.c5, notes.e5, notes.g5, notes.c6].forEach((f, i) => tone(c, { f, dur: 0.3, vol: 0.14, at: i * 0.07 }));
      break;
    case 'win':
      [notes.c5, notes.e5, notes.g5, notes.c6, notes.e6].forEach((f, i) => tone(c, { f, t: 'triangle', dur: 0.5, vol: 0.18, at: i * 0.12 }));
      break;
    case 'lose':
      [notes.g5, notes.e5, notes.c5, 262].forEach((f, i) => tone(c, { f, t: 'triangle', dur: 0.5, vol: 0.16, at: i * 0.16 }));
      break;
  }
}
