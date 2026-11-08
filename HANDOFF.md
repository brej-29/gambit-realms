# Gambit Realms: handoff

Live: https://brej-29.github.io/gambit-realms/ | Repo: https://github.com/brej-29/gambit-realms | Case study: README.md | Method and amendments: docs/DESIGN.md | Numbers: docs/results/RESULTS.md

## One paragraph

An old 220-line pygame chess app (Jan 2026) rebuilt as a browser game: animated pieces that fight on captures, four themed realms, eight opponents whose strength was measured against Stockfish, a rule-based coach that warns before a move that loses material, and eight interactive lessons. Static site on GitHub Pages, no server, no account.

## The problem chosen and why

First-time players get an opponent of the wrong shape (too strong, random, or engine "skill levels" whose mistakes are not beginner mistakes) and no explanation at the moment of a mistake. The measurable question: can a small in-browser layer give a ladder from first-timer to club player with beginner-shaped errors, plus a coach that warns before a material-losing move?

## Results (full run, 3,560 games, seeds 10,000 and up; parameters tuned on seeds 1 to 999 only)

| Target written before building | Result | Met |
|---|---|:---:|
| M1 each level beats the one below | 7 of 7 pairs, 70.8% to 99.8% | yes |
| M2 L1 at most 10% vs Stockfish 1320; L8 at least 60% vs 1900 | 7.5% and 100% | yes |
| M3 L1 to L4 blunder 3% to 15%, 60%+ of blunders hang a piece | rate 9.2% to 11.5%; hang share 75, 65, 56, 47% | no (L3, L4) |
| M4 coach precision 0.85+, recall 0.60+ | precision 64.8%, recall 75.4% | no (precision) |
| M5 p95 move 1.5 s or less, app 6 MB or less | 1,283 ms under load (650 to 810 ms idle), 2.5 MB | yes |

Ratings (Stockfish Elo-setting scale at 5,000 nodes, not Lichess): 950, 1138, 1338, 1641, 1835, 2017, 2253, and 2600+ for level 8. Baselines: Stockfish Skill 0 and UCI 1320 beat Level 1 about 9 games in 10; their blunders hang a piece only 23% to 29% of the time vs 75% for Level 1.

## Problems faced (good interview stories)

- Stockfish WASM "aborted at 300k nodes": really re-entrancy. My adapter sent UCI commands from inside the engine's output callback. Fixed with setImmediate. Found by bisecting the command sequence.
- The delegated first harness had fabricated CIs (rating +/- 60), sequential games, a circular coach label and a result-overwrite bug keyed by seed. Found by review, fixed, and logged as amendments before the reporting run.
- Engine-only errors did not look like beginner errors (hang share 16% vs 60% target). Added a greedy "oversight" move (grab the biggest piece, ignore the reply).
- Rating estimator bug (anchors weighted as one game) compressed all ratings to about 1450; caught by sanity-checking against raw scores.
- Anchors saturate: top level beats the 2600 anchor, so it is reported as a lower bound.
- Bundle was 6.02 MB (limit 6) because font packages ship every script; latin-only imports gave 2.5 MB.
- Realm cross-fade (view transition) swallowed clicks in slow browsers; capped at 800 ms. Found by the CI e2e job.
- Component CSS overrode the `hidden` attribute (Next button and coach buttons never hid). Found while recording GIFs; fixed with a global `[hidden]` rule (uncommitted work on this branch, see below).
- Tall billboard pieces swallowed clicks meant for the square behind; resolved by preferring a legal target under the pointer.

## Honest claims (do not overclaim)

Say: opponents are calibrated on Stockfish's own Elo scale; 3 of 5 pre-registered targets met; coach catches 75% of material-losing moves with about 1 in 3 false alarms. Do not say: "human-level ratings", "beginner-validated", or any Lichess/Chess.com rating. The beginner model (greedy plus noise) was checked against an engine's idea of a blunder, not human games.

## Repo map

src/core (ladder, SEE, coach, stats; no DOM) | src/engine (Node and Worker UCI adapters) | src/ui (board, realms, capture fights, lessons, evidence) | eval (game workers, labels, calibrate, verify, tune-coach) | docs/results (calibration, tuning, final results) | scripts (e2e, a11y, shots, gifs).

Run: `npm install; npm run dev; npm test; npm run e2e -- <url>; npm run a11y; npm run eval:quick; npm run eval` (full is about 2 hours on 16 cores). Re-record GIFs: `E2E_CHANNEL=msedge node scripts/gifs.mjs http://localhost:5173/` (needs ffmpeg).

## Portfolio blurb (resume)

- Rebuilt a pygame chess app into a browser game with a measured opponent ladder (8 levels, 950 to 2600+ on Stockfish's Elo scale) and a static-analysis coach; evaluated on 3,560 games with pre-registered targets, 3 of 5 met, misses published.
- Found and fixed a re-entrancy bug in a Stockfish WASM adapter and a circular evaluation label before reporting results.
- Shipped to GitHub Pages with unit, e2e (Chromium) and axe accessibility checks in CI.

## LinkedIn post draft (edit in your own voice)

I rebuilt my old chess project to answer one question: can a browser-only engine give a beginner an opponent that makes beginner mistakes, and a coach that warns before they hang a piece?

I wrote five targets down before building. After 3,560 games, three were met and two were not. Coach precision was 65% against my 85% target, and my middle levels did not hang pieces as often as I wanted. Both misses are on the Evidence page of the live site.

What I enjoyed most: the bug that looked like "Stockfish crashes at 300k nodes" was my adapter sending commands from inside the engine's own callback.

Every capture is an animated duel in four realms (spell bolts, sword clashes, glitch deletes, anime KOs). Free, no sign-up: https://brej-29.github.io/gambit-realms/

## Status and next steps

- Branch `docs/handoff-readme` holds: global `[hidden]` CSS fix, `scripts/gifs.mjs`, 8 GIFs in docs/img, this file, README gallery. NOT yet merged: open a PR, wait for CI, merge, then the Pages deploy republishes.
- Ideas: raise coach precision with a short tactical check (forks, mates); validate the beginner model against human games (Lichess open database); raise oversight at levels 3 and 4 for M3; add a stronger anchor scale for the top level.
- Housekeeping: stop leftover local vite servers, delete the git-excluded `.worktrees` folder and the untracked `stockfish/` copy (about 78 MB).
- The first import commit carries the real file date (2026-01-11); later commits use real dates by design.
