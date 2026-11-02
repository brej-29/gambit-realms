import type { Realm } from './audio';

export interface RealmInfo {
  id: Realm;
  name: string;
  tagline: string;
  blurb: string;
  duel: string;
  swatch: [string, string, string];
}

export const REALMS: RealmInfo[] = [
  { id: 'enchanted', name: 'Enchanted Hall', tagline: 'Candle-lit stone, living pieces', blurb: 'Pieces cast bolts of light. The captured one turns to stone and shatters.', duel: 'Spell duel', swatch: ['#0d0a1c', '#a68bff', '#e8b64c'] },
  { id: 'medieval', name: 'Iron Keep', tagline: 'Oak, banners and steel', blurb: 'Blades clash, sparks fly, and the loser topples in a cloud of dust.', duel: 'Sword fight', swatch: ['#17130d', '#c5412f', '#cfab72'] },
  { id: 'cyberpunk', name: 'Neon Grid', tagline: 'Rain, glass and glitch', blurb: 'A laser cut, a glitch, and the piece pixelates out of the board.', duel: 'Hack and delete', swatch: ['#06060f', '#19f3ff', '#ff35d1'] },
  { id: 'anime', name: 'Sakura Arena', tagline: 'Ink lines, speed lines, KO', blurb: 'Hit-stop, a diagonal slash, then the victim is launched into the sky.', duel: 'Final blow', swatch: ['#ffd9ea', '#ff4d8d', '#1c1233'] },
];

export const realmInfo = (id: Realm) => REALMS.find((r) => r.id === id)!;

export function currentRealm(): Realm {
  return (document.documentElement.dataset.realm as Realm) || 'enchanted';
}

/** Switch realm with a cross-fade where the browser supports view transitions. */
export function applyRealm(id: Realm) {
  const set = () => {
    document.documentElement.dataset.realm = id;
    document.dispatchEvent(new CustomEvent('realmchange', { detail: id }));
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { skipTransition(): void } };
  if (doc.startViewTransition && !reduce) {
    const vt = doc.startViewTransition(set);
    // While a view transition runs the page ignores input; never let a stalled one trap the player.
    setTimeout(() => vt.skipTransition(), 1200);
  } else set();
}
