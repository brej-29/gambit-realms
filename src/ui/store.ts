import type { Realm } from './audio';

export interface Settings {
  realm: Realm;
  level: number; // 1..8
  color: 'w' | 'b' | 'r';
  coach: boolean;
  sound: boolean;
  speed: 'normal' | 'fast';
}
const DEFAULTS: Settings = { realm: 'enchanted', level: 2, color: 'w', coach: true, sound: true, speed: 'normal' };
const KEY = 'gambit-realms:v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage can be blocked; the app still works */
  }
}

export const settings: Settings = read(KEY, DEFAULTS);
export function save(patch: Partial<Settings> = {}) {
  Object.assign(settings, patch);
  write(KEY, settings);
}

const PKEY = 'gambit-realms:progress:v1';
export const progress: { lessons: Record<string, boolean>; wins: number; games: number } = read(PKEY, { lessons: {}, wins: 0, games: 0 });
export function saveProgress() {
  write(PKEY, progress);
}
