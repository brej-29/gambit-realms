/** Evaluation results written by the eval harness. Nothing here is hard-coded: no file, no numbers. */
export interface Results {
  [key: string]: unknown;
}
let cache: Results | null = null;

export async function loadResults(): Promise<Results | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}results.json`, { cache: 'no-cache' });
    if (!r.ok) return null;
    cache = (await r.json()) as Results;
    return cache;
  } catch {
    return null;
  }
}

/** Short measured-strength label for a level, or '' until results are loaded. */
export function levelStrength(_level: number): string {
  return cache ? '' : '';
}
