export interface Interval {
  low: number;
  high: number;
}

export interface PairResult {
  a: string;
  b: string;
  scoreA: number;
  games: number;
}

export interface Anchor {
  id: string;
  rating: number;
}

export function score(wins: number, draws: number, losses: number): number {
  const games = wins + draws + losses;
  if (games <= 0) return 0.5;
  return (wins + draws / 2) / games;
}

export function wilsonInterval(value: number, games: number, z = 1.96): Interval {
  if (games <= 0) return { low: 0, high: 1 };
  const p = Math.max(0, Math.min(1, value));
  const denominator = 1 + (z * z) / games;
  const centre = (p + (z * z) / (2 * games)) / denominator;
  const spread = (z / denominator) * Math.sqrt((p * (1 - p)) / games + (z * z) / (4 * games * games));
  return { low: Math.max(0, centre - spread), high: Math.min(1, centre + spread) };
}

export function eloFromScore(value: number): number {
  const p = Math.max(0.0001, Math.min(0.9999, value));
  return 400 * Math.log10(p / (1 - p));
}

export function eloConfidence(value: number, games: number): Interval {
  const interval = wilsonInterval(value, games);
  return { low: eloFromScore(interval.low), high: eloFromScore(interval.high) };
}

/** Fit ratings to observed score differences while keeping anchor ratings fixed. */
export function fitLadder(pairings: readonly PairResult[], anchors: readonly Anchor[]): Record<string, number> {
  const fixed = new Map(anchors.map((anchor) => [anchor.id, anchor.rating]));
  const ids = new Set<string>();
  for (const pairing of pairings) {
    ids.add(pairing.a);
    ids.add(pairing.b);
  }
  const unknown = [...ids].filter((id) => !fixed.has(id));
  const index = new Map(unknown.map((id, i) => [id, i]));
  const n = unknown.length;
  const matrix = Array.from({ length: n }, () => Array<number>(n + 1).fill(0));
  for (const pairing of pairings) {
    const difference = eloFromScore(pairing.scoreA);
    const ia = index.get(pairing.a);
    const ib = index.get(pairing.b);
    const weight = Math.max(1, pairing.games);
    if (ia !== undefined) {
      const rowA = matrix[ia]!;
      rowA[ia] = (rowA[ia] ?? 0) + weight;
      rowA[n] = (rowA[n] ?? 0) + weight * difference;
      if (ib !== undefined) rowA[ib] = (rowA[ib] ?? 0) - weight;
      else rowA[n] = (rowA[n] ?? 0) + weight * (fixed.get(pairing.b) ?? 0);
    }
    if (ib !== undefined) {
      const rowB = matrix[ib]!;
      rowB[ib] = (rowB[ib] ?? 0) + weight;
      rowB[n] = (rowB[n] ?? 0) - weight * difference;
      if (ia !== undefined) rowB[ia] = (rowB[ia] ?? 0) - weight;
      else rowB[n] = (rowB[n] ?? 0) + weight * (fixed.get(pairing.a) ?? 0);
    }
  }
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(matrix[row]![column] ?? 0) > Math.abs(matrix[pivot]![column] ?? 0)) pivot = row;
    if (Math.abs(matrix[pivot]![column] ?? 0) < 1e-9) continue;
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];
    const pivotRow = matrix[column]!;
    const divisor = pivotRow[column]!;
    for (let c = column; c <= n; c++) pivotRow[c] = (pivotRow[c] ?? 0) / divisor;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const currentRow = matrix[row]!;
      const factor = currentRow[column] ?? 0;
      for (let c = column; c <= n; c++) currentRow[c] = (currentRow[c] ?? 0) - factor * (pivotRow[c] ?? 0);
    }
  }
  const ratings: Record<string, number> = Object.fromEntries(anchors.map((anchor) => [anchor.id, anchor.rating]));
  unknown.forEach((id, i) => { ratings[id] = matrix[i]?.[n] ?? 1500; });
  return ratings;
}

