/** Shape of public/results.json, written by `npm run eval`. The UI shows these numbers verbatim; nothing is hard-coded. */
export interface LevelRating { id: string; name: string; rating: number; ciLow: number; ciHigh: number; saturated?: boolean }
export interface PairResult { a: string; b: string; score: number; low: number; high: number; games: number; pass: boolean }
export interface AnchorResult { match: string; score: number; low: number; high: number; pass: boolean; games?: number }
export interface BlunderRow { player: string; games: number; moves: number; blunders: number; blunderRate: number; hangingBlunders: number; hangingShare: number }
export interface CoachRow { name: string; label: 'A' | 'B'; pairs: number; positives: number; predicted: number; truePositives: number; precision: number; recall: number }
export interface MetricResult { pass: boolean; value: unknown; threshold: string }
export interface ErrorExample { fen: string; move: string; referenceCpl?: number; referenceMaterialLoss?: number; referencePv?: string }
export interface Results {
  meta: { engine: string; profile: string; generatedAt: string; reportingSeedStart: number; tuningSeeds: string; referenceNodes: number };
  levels: LevelRating[];
  pairs: PairResult[];
  anchors: AnchorResult[];
  blunders: BlunderRow[];
  coach: CoachRow[];
  latency: { p95Ms: number; bundleBytes?: number };
  metrics: Record<'M1' | 'M2' | 'M3' | 'M4' | 'M5', MetricResult>;
  errorAnalysis?: { falsePositives: ErrorExample[]; falseNegatives: ErrorExample[] };
}

let cache: Results | null = null;
let pending: Promise<Results | null> | null = null;

export function loadResults(): Promise<Results | null> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch(`${import.meta.env.BASE_URL}results.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Results>) : null))
    .then((r) => (cache = r))
    .catch(() => null);
  return pending;
}

/** Measured strength label for a level, e.g. "about 1180 on the anchor scale", or '' when no results are loaded. */
export function levelStrength(level: number): string {
  const l = cache?.levels.find((x) => x.id === `L${level}`);
  return l ? `about ${Math.round(l.rating / 10) * 10} on the anchor scale (95% CI ${Math.round(l.ciLow)} to ${Math.round(l.ciHigh)})` : '';
}
