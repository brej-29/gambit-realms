import { loadResults, type Results } from './results';

const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const REPO = 'https://github.com/brej-29/gambit-realms';

const METRIC_TITLES: Record<string, string> = {
  M1: 'Each level beats the one below it',
  M2: 'The ladder spans first-timer to club player',
  M3: 'Weak levels blunder like beginners',
  M4: 'Coach warns before material-losing moves',
  M5: 'Fast and small enough for free hosting',
};

function chart(r: Results) {
  const lv = r.levels;
  const lo = Math.min(...lv.map((l) => l.ciLow)) - 80;
  const hi = Math.max(...lv.map((l) => l.ciHigh)) + 80;
  const W = 760, rowH = 38, padL = 150, padR = 24, H = lv.length * rowH + 44;
  const x = (v: number) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  const ticks = Array.from({ length: 6 }, (_, i) => Math.round((lo + ((hi - lo) * i) / 5) / 50) * 50);
  return `<svg class="ladder-chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lc-t lc-d">
    <title id="lc-t">Measured strength of the eight opponents</title>
    <desc id="lc-d">${esc(lv.map((l) => `${l.name} ${Math.round(l.rating)}, interval ${Math.round(l.ciLow)} to ${Math.round(l.ciHigh)}`).join('; '))}</desc>
    ${ticks.map((t) => `<g><line x1="${x(t)}" x2="${x(t)}" y1="8" y2="${H - 28}" class="grid-l"/><text x="${x(t)}" y="${H - 10}" class="tick" text-anchor="middle">${t}</text></g>`).join('')}
    ${lv.map((l, i) => {
      const y = 22 + i * rowH;
      return `<g><text x="${padL - 14}" y="${y + 5}" text-anchor="end" class="lab">${i + 1}. ${esc(l.name)}</text>
        <line x1="${x(l.ciLow)}" x2="${x(l.ciHigh)}" y1="${y}" y2="${y}" class="ci"/>
        <circle cx="${x(l.rating)}" cy="${y}" r="7" class="dot"/><text x="${x(l.rating)}" y="${y - 12}" text-anchor="middle" class="val">${Math.round(l.rating)}</text></g>`;
    }).join('')}
  </svg>`;
}

function render(el: HTMLElement, r: Results) {
  const passCount = Object.values(r.metrics).filter((m) => m.pass).length;
  const m3 = r.blunders;
  el.innerHTML = `
    <header class="page-head"><h1>Evidence</h1>
      <p class="lede">Every opponent and the coach are measured, not guessed. ${passCount} of 5 pre-registered targets were met in the last run, and the misses are listed too.</p></header>
    <div class="evidence-grid">
      <section class="card ev-block"><h2>How strong is each opponent?</h2>
        <p class="sub">Rating on the anchor scale: Stockfish's own Elo setting, run at a fixed node budget. It is not a Lichess or Chess.com rating. Bars show the 95% interval.</p>
        ${chart(r)}</section>
      <section class="ev-metrics">${(['M1', 'M2', 'M3', 'M4', 'M5'] as const).map((k) => `
        <article class="card metric ${r.metrics[k].pass ? 'ok' : 'miss'}"><span class="badge">${r.metrics[k].pass ? 'Target met' : 'Target missed'}</span>
          <h3>${METRIC_TITLES[k]}</h3><p class="sub">Target: ${esc(r.metrics[k].threshold)}</p></article>`).join('')}</section>
      <section class="card ev-block"><h2>Does each level beat the one below?</h2>
        <div class="table-wrap"><table><thead><tr><th>Match</th><th>Score</th><th>95% interval</th><th>Games</th><th>Result</th></tr></thead><tbody>
        ${r.pairs.map((p) => `<tr><td>${p.a} vs ${p.b}</td><td>${pct(p.score, 1)}</td><td>${pct(p.low)} to ${pct(p.high)}</td><td>${p.games}</td><td class="${p.pass ? 'good' : 'bad'}">${p.pass ? 'Pass' : 'Miss'}</td></tr>`).join('')}
        ${r.anchors.map((p) => `<tr><td>${esc(p.match)}</td><td>${pct(p.score, 1)}</td><td>${pct(p.low)} to ${pct(p.high)}</td><td>${p.games ?? ''}</td><td class="${p.pass ? 'good' : 'bad'}">${p.pass ? 'Pass' : 'Miss'}</td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card ev-block"><h2>Do weak levels blunder like beginners?</h2>
        <p class="sub">A blunder is a move that loses at least 2 pawns of evaluation according to Stockfish. "Hangs a piece" is the share of blunders that leave a piece capturable for a net loss.</p>
        <div class="table-wrap"><table><thead><tr><th>Player</th><th>Moves</th><th>Blunder rate</th><th>Hangs a piece</th></tr></thead><tbody>
        ${m3.map((b) => `<tr><td>${esc(b.player)}</td><td>${b.moves}</td><td>${pct(b.blunderRate, 1)}</td><td>${pct(b.hangingShare)}</td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card ev-block"><h2>Does the coach warn at the right time?</h2>
        <p class="sub">The coach checks the move before you confirm it, using static exchange evaluation, and warns when the move loses material. Compared against two simpler rules.</p>
        <div class="table-wrap"><table><thead><tr><th>Method</th><th>Positions</th><th>Precision</th><th>Recall</th></tr></thead><tbody>
        ${r.coach.map((c) => `<tr><td>${esc(c.name)}</td><td>${c.pairs}</td><td>${pct(c.precision)}</td><td>${pct(c.recall)}</td></tr>`).join('')}
        </tbody></table></div>
        ${r.errorAnalysis?.falsePositives.length ? `<details><summary>Where the coach is wrong (${r.errorAnalysis.falsePositives.length} false warnings shown)</summary><ul class="fens">${r.errorAnalysis.falsePositives.slice(0, 5).map((f) => `<li><code>${esc(f.fen)}</code> move <b>${esc(f.move)}</b>: ${esc(f.reason)}</li>`).join('')}</ul></details>` : ''}</section>
      <section class="card ev-block"><h2>How this was run</h2>
        <p>Engine: ${esc(r.meta.engine)}. Profile: ${esc(r.meta.profile)}. Reporting seeds start at ${r.meta.reportingSeedStart}; tuning used seeds ${esc(r.meta.tuningSeeds)}. Generated ${esc(r.meta.generatedAt.slice(0, 10))}. Move time at the strongest level: ${Math.round(r.latency.p95Ms)} ms (95th percentile, Node).</p>
        <p><a href="${REPO}/blob/master/docs/DESIGN.md">Pre-registered targets</a> · <a href="${REPO}/blob/master/docs/results/RESULTS.md">Full results</a> · Reproduce with <code>npm run eval</code>.</p></section>
    </div>`;
}

export function evidenceView() {
  const el = document.createElement('section');
  el.className = 'evidence';
  el.innerHTML = '<header class="page-head"><h1>Evidence</h1><p class="lede">Loading measured results…</p></header>';
  void loadResults().then((r) => {
    if (!el.isConnected && !r) return;
    if (r) render(el, r);
    else el.innerHTML = '<header class="page-head"><h1>Evidence</h1></header><div class="card empty-state"><h2>No results file found</h2><p class="lede">Run <code>npm run eval:quick</code> and rebuild to see the measured strength of each opponent here.</p></div>';
  });
  return { el, destroy() {} };
}
