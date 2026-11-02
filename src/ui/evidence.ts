import { loadResults, type CoachRow, type Results } from './results';

const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const REPO = 'https://github.com/brej-29/gambit-realms';

const COACH_NAMES: Record<string, string> = {
  'coach-see': 'Coach (any piece left en prise)',
  'coach-moved-piece-only': 'Coach, original rule (moved piece only)',
  'coach-see-without-defender-count': 'Coach without counting defenders',
  'coach-without-pinned-piece-rule': 'Coach without the pinned-piece rule',
  'warn-if-attacked': 'Baseline: warn if the square is attacked',
  'never-warn': 'Baseline: never warn',
};

function measured(r: Results, k: 'M1' | 'M2' | 'M3' | 'M4' | 'M5'): string {
  const passed = r.pairs.filter((p) => p.pass).length;
  const low = r.blunders.filter((b) => /^L[1-4]$/.test(b.player));
  const coach = r.coach.find((c) => c.name === 'coach-see' && c.label === 'B');
  const l1 = r.anchors.find((a) => a.match.startsWith('L1'));
  const l8 = r.anchors.find((a) => a.match.startsWith('L8'));
  switch (k) {
    case 'M1':
      return `${passed} of ${r.pairs.length} adjacent pairs passed.`;
    case 'M2':
      return `Level 1 scores ${l1 ? pct(l1.score) : '?'} against the 1320 anchor; Level 8 scores ${l8 ? pct(l8.score) : '?'} against 1900.`;
    case 'M3':
      return low.length ? `Levels 1 to 4 blunder ${pct(Math.min(...low.map((b) => b.blunderRate)))} to ${pct(Math.max(...low.map((b) => b.blunderRate)))} of moves; ${pct(Math.min(...low.map((b) => b.hangingShare)))} to ${pct(Math.max(...low.map((b) => b.hangingShare)))} of those leave a piece hanging.` : '';
    case 'M4':
      return coach ? `Precision ${pct(coach.precision, 1)}, recall ${pct(coach.recall, 1)} on ${coach.pairs} positions.` : '';
    case 'M5':
      return `Strongest level answers in ${Math.round(r.latency.p95Ms)} ms (95th percentile)${r.latency.bundleBytes ? `; app is ${(r.latency.bundleBytes / 1e6).toFixed(1)} MB` : ''}.`;
  }
}

const METRIC_TITLES: Record<string, string> = {
  M1: 'Each level beats the one below it',
  M2: 'The ladder spans first-timer to club player',
  M3: 'Weak levels blunder like beginners',
  M4: 'Coach warns before material-losing moves',
  M5: 'Fast and small enough for free hosting',
};

function chart(r: Results) {
  const lv = r.levels;
  const lo = Math.min(...lv.map((l) => l.ciLow)) - 60;
  const hi = Math.max(...lv.map((l) => (l.saturated ? l.rating + 140 : l.ciHigh))) + 60;
  const W = 760, rowH = 38, padL = 150, padR = 24, H = lv.length * rowH + 44;
  const x = (v: number) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  const ticks = Array.from({ length: 6 }, (_, i) => Math.round((lo + ((hi - lo) * i) / 5) / 50) * 50);
  const label = (l: (typeof lv)[number]) => (l.saturated ? `${Math.round(l.rating)}+` : String(Math.round(l.rating)));
  return `<svg class="ladder-chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lc-t lc-d">
    <title id="lc-t">Measured strength of the eight opponents</title>
    <desc id="lc-d">${esc(lv.map((l) => `${l.name} ${l.saturated ? 'at least ' : ''}${Math.round(l.rating)}${l.saturated ? '' : `, interval ${Math.round(l.ciLow)} to ${Math.round(l.ciHigh)}`}`).join('; '))}</desc>
    ${ticks.map((t) => `<g><line x1="${x(t)}" x2="${x(t)}" y1="8" y2="${H - 28}" class="grid-l"/><text x="${x(t)}" y="${H - 10}" class="tick" text-anchor="middle">${t}</text></g>`).join('')}
    ${lv.map((l, i) => {
      const y = 22 + i * rowH;
      const arrow = l.saturated ? `<path d="M${x(l.rating) + 12} ${y - 6} l12 6 l-12 6z" class="dot"/><line x1="${x(l.rating)}" x2="${x(l.rating) + 14}" y1="${y}" y2="${y}" class="ci"/>` : `<line x1="${x(l.ciLow)}" x2="${x(l.ciHigh)}" y1="${y}" y2="${y}" class="ci"/>`;
      return `<g><text x="${padL - 14}" y="${y + 5}" text-anchor="end" class="lab">${i + 1}. ${esc(l.name)}</text>${arrow}
        <circle cx="${x(l.rating)}" cy="${y}" r="7" class="dot"/><text x="${x(l.rating)}" y="${y - 12}" text-anchor="middle" class="val">${label(l)}</text></g>`;
    }).join('')}
  </svg>`;
}

function coachTable(rows: CoachRow[], label: 'A' | 'B') {
  return `<div class="table-wrap"><table><thead><tr><th>Method</th><th>Positions</th><th>Precision</th><th>Recall</th></tr></thead><tbody>
    ${rows.filter((c) => c.label === label).map((c) => `<tr><td>${esc(COACH_NAMES[c.name] ?? c.name)}</td><td>${c.pairs}</td><td>${pct(c.precision, 1)}</td><td>${pct(c.recall, 1)}</td></tr>`).join('')}</tbody></table></div>`;
}

function render(el: HTMLElement, r: Results) {
  const passCount = Object.values(r.metrics).filter((m) => m.pass).length;
  const sat = r.levels.some((l) => l.saturated);
  el.innerHTML = `
    <header class="page-head"><h1>Evidence</h1>
      <p class="lede">Every opponent and the coach are measured, not guessed. ${passCount} of 5 targets written down before building were met in the last run. The misses are listed too.</p></header>
    <div class="evidence-grid">
      <section class="card ev-block"><h2>How strong is each opponent?</h2>
        <p class="sub">Rating on the anchor scale: Stockfish's own Elo setting at a fixed 5,000-node budget (anchors 1320, 1900 and 2600). It is not a Lichess or Chess.com rating, and real beginners are likely to sit below the bottom of this scale. Bars show the 95% interval.${sat ? ' A plus sign means the level beat the strongest anchor almost every game, so only a lower bound can be given.' : ''}</p>
        <div class="table-wrap">${chart(r)}</div></section>
      <section class="ev-metrics">${(['M1', 'M2', 'M3', 'M4', 'M5'] as const).map((k) => `
        <article class="card metric ${r.metrics[k].pass ? 'ok' : 'miss'}"><span class="badge">${r.metrics[k].pass ? 'Target met' : 'Target missed'}</span>
          <h3>${METRIC_TITLES[k]}</h3><p>${esc(measured(r, k))}</p><p class="sub">Target: ${esc(r.metrics[k].threshold)}</p></article>`).join('')}</section>
      <section class="card ev-block"><h2>Does each level beat the one below?</h2>
        <div class="table-wrap"><table><thead><tr><th>Match</th><th>Score</th><th>95% interval</th><th>Games</th><th>Result</th></tr></thead><tbody>
        ${r.pairs.map((p) => `<tr><td>${esc(p.a)} vs ${esc(p.b)}</td><td>${pct(p.score, 1)}</td><td>${pct(p.low)} to ${pct(p.high)}</td><td>${p.games}</td><td class="${p.pass ? 'good' : 'bad'}">${p.pass ? 'Pass' : 'Miss'}</td></tr>`).join('')}
        ${r.anchors.map((p) => `<tr><td>${esc(p.match)}</td><td>${pct(p.score, 1)}</td><td>${pct(p.low)} to ${pct(p.high)}</td><td>${p.games ?? ''}</td><td class="${p.pass ? 'good' : 'bad'}">${p.pass ? 'Pass' : 'Miss'}</td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card ev-block"><h2>Do weak levels blunder like beginners?</h2>
        <p class="sub">A blunder is a move that loses at least 2 pawns of evaluation according to Stockfish at 300,000 nodes. "Hangs a piece" is the share of blunders that leave a piece capturable for a net loss. The baselines are what you get from a random mover, the original minimax of this project, Stockfish's own Skill Level 0, and Stockfish at the 1320 setting.</p>
        <div class="table-wrap"><table><thead><tr><th>Player</th><th>Moves checked</th><th>Blunder rate</th><th>Hangs a piece</th></tr></thead><tbody>
        ${[...r.blunders].sort((a, b) => a.player.localeCompare(b.player)).map((b) => `<tr><td>${esc(b.player)}</td><td>${b.moves}</td><td>${pct(b.blunderRate, 1)}</td><td>${pct(b.hangingShare)}</td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card ev-block"><h2>Does the coach warn at the right time?</h2>
        <p class="sub">The coach checks a move before you confirm it, using static exchange evaluation, and warns when the move leaves material hanging. "Loses material" means that following Stockfish's best line for four plies leaves the mover at least a pawn down. Compared with simpler rules and two ablations.</p>
        ${coachTable(r.coach, 'B')}
        <details><summary>Stricter label: any move Stockfish rates 1.5 pawns worse</summary>${coachTable(r.coach, 'A')}</details>
        ${r.errorAnalysis?.falsePositives.length ? `<details><summary>Where the coach warned and Stockfish disagreed (${r.errorAnalysis.falsePositives.length} examples)</summary><ul class="fens">${r.errorAnalysis.falsePositives.slice(0, 5).map((f) => `<li><code>${esc(f.fen)}</code> move <b>${esc(f.move)}</b>${f.referenceMaterialLoss !== undefined ? `, material change ${esc(f.referenceMaterialLoss)} cp` : ''}</li>`).join('')}</ul></details>` : ''}</section>
      <section class="card ev-block"><h2>How this was run</h2>
        <p>Engine: ${esc(r.meta.engine)}. Profile: ${esc(r.meta.profile)}. Reporting seeds start at ${esc(r.meta.reportingSeedStart)}; tuning used seeds ${esc(r.meta.tuningSeeds)}. Generated ${esc(String(r.meta.generatedAt).slice(0, 10))}.</p>
        <p><a href="${REPO}/blob/master/docs/DESIGN.md">Targets written before building</a> · <a href="${REPO}/blob/master/docs/results/RESULTS.md">Full results</a> · Reproduce with <code>npm run eval</code>.</p></section>
    </div>`;
}

export function evidenceView() {
  const el = document.createElement('section');
  el.className = 'evidence';
  el.innerHTML = '<header class="page-head"><h1>Evidence</h1><p class="lede">Loading measured results…</p></header>';
  void loadResults().then((r) => {
    if (r) render(el, r);
    else el.innerHTML = '<header class="page-head"><h1>Evidence</h1></header><div class="card empty-state"><h2>No results file found</h2><p class="lede">Run <code>npm run eval:quick</code> and rebuild to see the measured strength of each opponent here.</p></div>';
  });
  return { el, destroy() {} };
}
