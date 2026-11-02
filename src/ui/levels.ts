import type { PieceType } from './pieces';

export interface LevelUi {
  id: number;
  name: string;
  piece: PieceType;
  blurb: string;
}

/** Names and copy for the eight opponents. Strength numbers come from the generated results, never from here. */
export const LEVELS_UI: LevelUi[] = [
  { id: 1, name: 'Sleepy Pawn', piece: 'p', blurb: 'Just learned the rules. Drops pieces and misses almost everything. Best for your very first games.' },
  { id: 2, name: 'Eager Squire', piece: 'p', blurb: 'Grabs free pieces but misses simple traps. Forgiving, with a little bite.' },
  { id: 3, name: 'Clever Knight', piece: 'n', blurb: 'Sees one or two moves ahead. Punishes a hanging piece.' },
  { id: 4, name: 'Wily Bishop', piece: 'b', blurb: 'Sets small traps and rarely gifts material.' },
  { id: 5, name: 'Stern Rook', piece: 'r', blurb: 'Solid and patient. Expect to defend carefully.' },
  { id: 6, name: 'Sharp Queen', piece: 'q', blurb: 'Tactically alert. A casual mistake costs you a piece.' },
  { id: 7, name: 'Old Master', piece: 'k', blurb: 'Plays like a seasoned club player.' },
  { id: 8, name: 'Archmage', piece: 'q', blurb: 'The strongest the browser can summon. Bring your best.' },
];
