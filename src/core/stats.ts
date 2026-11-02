export interface Interval {
  low: number;
  high: number;
}

export interface PairResult {
  a: string;
  b: string;
  scoreA: number;
  games: number;
  outcomes?: readonly number[];
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

function probability(ratingA: number, ratingB: number): number {
  const x = (ratingA - ratingB) * Math.LN10 / 400;
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const exp = Math.exp(x);
  return exp / (1 + exp);
}

function outcomeCounts(pairing: PairResult): { wins: number; losses: number; draws: number } {
  if (pairing.outcomes?.length) {
    return {
      wins: pairing.outcomes.filter((outcome) => outcome === 1).length,
      losses: pairing.outcomes.filter((outcome) => outcome === 0).length,
      draws: pairing.outcomes.filter((outcome) => outcome === 0.5).length,
    };
  }
  const wins = Math.round(pairing.scoreA * pairing.games);
  return { wins, losses: Math.max(0, pairing.games - wins), draws: 0 };
}

/** Maximum-likelihood logistic fit with the supplied anchor ratings held fixed. */
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
  const ratings = new Map<string, number>(anchors.map((anchor) => [anchor.id, anchor.rating]));
  unknown.forEach((id, i) => ratings.set(id, 1500 + i * 10));
  for (let iteration = 0; iteration < 80; iteration++) {
    const gradient = Array<number>(n).fill(0);
    const hessian = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (const pairing of pairings) {
      const a = ratings.get(pairing.a) ?? fixed.get(pairing.a) ?? 1500;
      const b = ratings.get(pairing.b) ?? fixed.get(pairing.b) ?? 1500;
      const p = probability(a, b);
      const counts = outcomeCounts(pairing);
      const observed = counts.wins + counts.draws / 2;
      const total = counts.wins + counts.draws + counts.losses;
      const scale = Math.LN10 / 400;
      const residual = observed - total * p;
      const ia = index.get(pairing.a);
      const ib = index.get(pairing.b);
      if (ia !== undefined) gradient[ia] = (gradient[ia] ?? 0) + scale * residual;
      if (ib !== undefined) gradient[ib] = (gradient[ib] ?? 0) - scale * residual;
      const curvature = total * p * (1 - p) * scale * scale;
      if (ia !== undefined) hessian[ia]![ia] = (hessian[ia]![ia] ?? 0) + curvature;
      if (ib !== undefined) hessian[ib]![ib] = (hessian[ib]![ib] ?? 0) + curvature;
      if (ia !== undefined && ib !== undefined) {
        hessian[ia]![ib] = (hessian[ia]![ib] ?? 0) - curvature;
        hessian[ib]![ia] = (hessian[ib]![ia] ?? 0) - curvature;
      }
    }
    const delta = solveLinearSystem(hessian, gradient);
    let largest = 0;
    for (let i = 0; i < n; i++) {
      const change = Math.max(-250, Math.min(250, delta[i] ?? 0));
      const id = unknown[i]!;
      ratings.set(id, (ratings.get(id) ?? 1500) + change);
      largest = Math.max(largest, Math.abs(change));
    }
    if (largest < 0.01) break;
  }
  const result: Record<string, number> = Object.fromEntries(anchors.map((anchor) => [anchor.id, anchor.rating]));
  unknown.forEach((id) => { result[id] = ratings.get(id) ?? 1500; });
  return result;
}

function solveLinearSystem(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  if (n === 0) return [];
  const a = matrix.map((row, i) => [...row, rhs[i] ?? 0]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(a[row]![column] ?? 0) > Math.abs(a[pivot]![column] ?? 0)) pivot = row;
    if (Math.abs(a[pivot]![column] ?? 0) < 1e-12) continue;
    [a[column], a[pivot]] = [a[pivot]!, a[column]!];
    const divisor = a[column]![column]!;
    for (let c = column; c <= n; c++) a[column]![c] = (a[column]![c] ?? 0) / divisor;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = a[row]![column] ?? 0;
      for (let c = column; c <= n; c++) a[row]![c] = (a[row]![c] ?? 0) - factor * (a[column]![c] ?? 0);
    }
  }
  return a.map((row) => row[n] ?? 0);
}

export function bootstrapLadderIntervals(
  pairings: readonly PairResult[],
  anchors: readonly Anchor[],
  resamples = 400,
  seed = 1,
): Record<string, Interval> {
  if (resamples < 400) throw new Error('rating bootstrap requires at least 400 resamples');
  const samples = new Map<string, number[]>();
  const rng = mulberry32(seed);
  for (let sample = 0; sample < resamples; sample++) {
    const resampled = pairings.map((pairing) => {
      const outcomes = pairing.outcomes?.length ? Array.from({ length: pairing.outcomes.length }, () => pairing.outcomes![Math.floor(rng() * pairing.outcomes!.length)]!) : undefined;
      return { ...pairing, outcomes, games: outcomes?.length ?? pairing.games };
    });
    const ratings = fitLadder(resampled, anchors);
    for (const [id, rating] of Object.entries(ratings)) {
      const values = samples.get(id) ?? [];
      values.push(rating);
      samples.set(id, values);
    }
  }
  const result: Record<string, Interval> = {};
  for (const [id, values] of samples) {
    values.sort((a, b) => a - b);
    result[id] = { low: percentile(values, 0.025), high: percentile(values, 0.975) };
  }
  return result;
}

function percentile(values: readonly number[], fraction: number): number {
  if (!values.length) return 0;
  const position = (values.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower]!;
  const weight = position - lower;
  return values[lower]! * (1 - weight) + values[upper]! * weight;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

