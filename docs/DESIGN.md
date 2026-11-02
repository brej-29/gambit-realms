# Gambit Realms: design and pre-registered evaluation

Status: written 2026-11-02, before any solution code. Thresholds below were fixed before the first tuning run. If a result misses its threshold it is reported as a miss, not re-defined.

## 1. The problem

A first-time chess player drops out for two reasons that existing free tools handle badly.

1. **The opponent is the wrong shape.** A beginner needs a partner that is slightly stronger than them and that makes *beginner-looking* mistakes (leaves a piece hanging, misses a fork). Typical options are:
   - a full-strength engine, which crushes them silently;
   - a depth-capped material-only minimax (what this repo's original pygame version used), which plays plausibly but has no tunable strength;
   - a random-move or "skill level" engine, whose mistakes look nothing like human ones (hanging a queen for nothing, or never erring at all).
2. **Nothing explains the mistake at the moment it is made.** Post-game analysis arrives after the learner has stopped caring.

The project asks a measurable question: **can a small in-browser engine layer give a calibrated ladder of opponents whose strength spans a first-time player to a club player, with human-shaped errors, plus a coach that warns before a material-losing move with high precision?**

Everything runs client-side (Stockfish 19 lite compiled to WASM, ~1.8 MB) so hosting is free and static.

## 2. Hypotheses and success thresholds

All strength numbers are on the **anchor scale** ("SF-Elo"): Stockfish's `UCI_Elo` setting with `UCI_LimitStrength` on, run with the same fixed node budget in every match. This is *not* a Lichess, Chess.com or FIDE rating. It is a relative scale that makes levels comparable with one another and with named baselines. Where a level sits below the lowest anchor (UCI_Elo 1320) its rating is chained through head-to-head matches and carries wider uncertainty.

### M1. Ladder separation (primary)
- 8 levels, L1 (weakest) to L8 (strongest).
- For every adjacent pair, the stronger level scores **>= 60%** over at least 200 games (colours alternated, varied openings) **and** the lower bound of the 95% Wilson interval of the score is **> 50%**.
- Pass = all 7 adjacent pairs pass.

### M2. Range
- L1 scores **<= 10%** against the UCI_Elo 1320 anchor (so L1 is well under 1320 on the anchor scale).
- L8 scores **>= 60%** against the UCI_Elo 1900 anchor.
- Reported with 95% intervals; Elo estimates derived from score with the logistic model, intervals from the Wilson bounds.

### M3. Human-shaped errors at the low end
Ground truth for a move's quality: Stockfish 19 lite at 300,000 nodes, MultiPV 1. Centipawn loss (CPL) = best eval minus eval after the played move, from the mover's side, with mate scores clipped at 1000. A *blunder* is a move with CPL >= 200.
- For L1 to L4: per-move blunder rate between **3% and 15%**. (This band is a design choice, not human-validated; see limits.)
- For L1 to L4: at least **60% of blunders leave a piece capturable for net material loss** (a "hung piece" by static exchange evaluation), because that is what beginner blunders look like.
- Baselines measured with the same code: random mover, the original minimax (depth 2, material only, ported to TypeScript), Stockfish `Skill Level 0`, and Stockfish `UCI_Elo 1320`. The expectation, stated up front: random blunders far too often; Skill Level 0 and UCI_Elo 1320 blunder too rarely or too weakly to be a first-time player's partner.

### M4. Coach: pre-move safety warning
The coach inspects a candidate move before it is confirmed and says whether it loses material, using static exchange evaluation on top of chess.js, no engine call.
- Label: a move "loses material" if the reference engine's CPL after it is >= 150 **and** the opponent has a capture of a piece worth more than what it recaptures (net SEE loss >= 100 cp) within one ply.
- Dataset: at least 5,000 (position, move) pairs sampled from games of levels L1 to L4 and the baselines, stratified so that both labels are well represented. Evaluation positions come from seeds never used in tuning.
- Targets: **precision >= 0.85, recall >= 0.60**.
- Baselines: (a) warn if the destination square is attacked at all, (b) never warn. Both reported.
- Ablation: SEE without the defender count; coach with and without the "pinned piece" rule.

### M5. Cost
- p95 time to produce one engine move at the L8 setting, measured in Node with the WASM build: **<= 1.5 s**.
- Production bundle (JS + CSS + engine + fonts, transferred): **<= 6 MB**.

### Amendments (logged before any reporting run)

**Amendment 1, 2026-11-02.** The M4 label above contained the coach's own SEE term, which makes precision partly circular. It is replaced by two engine-only labels, both computed from the reference engine (300,000 nodes):

- **Label A, engine blunder:** centipawn loss of the move >= 150.
- **Label B, loses material under engine play** (the claim the coach makes): play the reference engine's principal variation from the position after the move for 4 plies; the mover is at least 100 cp of material worse off than before the move.

The precision >= 0.85 and recall >= 0.60 targets apply to Label B. Label A is reported next to it. The coach and the thresholds are unchanged.

**Amendment 2, 2026-11-02.** Rating intervals come from a bootstrap over games (percentile 95%), not from the Wilson bounds alone, because ratings are fitted jointly. Ratings are a maximum-likelihood logistic fit with the two Stockfish anchors fixed at their nominal values.

## 3. Method

- **Games:** every match starts from a deterministic, seeded opening (4 random plies, kept only if the reference eval is within +/-150 cp so no game starts decided). Each opening is played twice with colours swapped. Draw by repetition, 50-move rule, insufficient material, or ply 300 (adjudicated by reference eval: > +300 cp counts as a win).
- **Seeds:** tuning uses seeds 1 to 999. All reported numbers use seeds >= 10000. Tuning and reporting never share an opening.
- **Statistics:** score = (wins + 0.5 draws) / games; 95% Wilson interval; Elo from the logistic model; ladder rating by least-squares fit of all pairings (anchors fixed to their nominal values).
- **Reproducibility:** `npm run eval` regenerates `docs/results/*.json` and `docs/results/RESULTS.md` from the repo alone. `npm run eval:quick` runs a reduced profile in CI. Node-count limits (not wall-clock) make results machine-independent.
- **Honesty rules:** negative results are kept in the results file and the README. Level parameters are chosen on tuning seeds only.

## 4. Solution sketch

### 4.1 Opponent ladder (`src/core/ladder.ts`)
Each level is `{ nodes, multipv, temperature, ... }`. The engine returns the top-K lines with centipawn scores; a seeded sampler picks a move with weight `exp(-loss/temperature)` over the K candidates. Low levels use few nodes (shallow, tactically short-sighted) and a high temperature (sometimes picks a plausible-but-worse move). High levels use many nodes and temperature near zero. The sampler is a pure function, unit-tested.

### 4.2 Coach (`src/core/coach.ts`, `src/core/see.ts`)
- Static exchange evaluation for any capture sequence on a square.
- `assessMove(fen, move)` returns `{ hangs: boolean, piece, attackers, defenders, netLoss, message }` with a plain-language explanation.
- `explainThreats(fen)` lists the player's pieces currently en prise, used for the "danger" glow.
- A hint button asks the engine for the best move and explains it in words (capture, check, safe development, etc.).

### 4.3 Learn mode (Academy)
Seven short interactive lessons (board and goal, each piece, capture, check and mate, special moves, safe play) followed by a coached first game: legal-move dots, danger glow on hanging pieces, a warning before a blunder with an "undo that" option, a hint button, and an opponent held at L1 to L2 by default.

### 4.4 Themed realms (UI)
One piece rig, four realms. Each realm re-skins palette, board, piece art, ambient animation, capture choreography and sound:

| Realm | Mood | Capture choreography |
|---|---|---|
| Enchanted (wizard chess) | candle-lit stone hall, runes | attacker strikes with a spell bolt, victim shatters into stone shards |
| Medieval | parchment, banners, iron | attacker lunges, blades clash, victim crumbles to dust |
| Cyberpunk | neon grid, scanlines | glitch-slice, victim pixelates and drops |
| Anime | cel-shaded, speed lines | slash cut-in, victim bursts with a KO star |

Pieces move physically: slide with a hop (knights arc over others), face the direction of travel, and captured pieces visibly die before being removed.

### 4.5 Evidence in the product
The ladder chart (rating per level with intervals) and the coach precision/recall are loaded from the generated `results.json` and shown in an "Evidence" panel, so the numbers on screen are the numbers in the repo.

## 5. Architecture

```
src/core/   rules + engine-agnostic logic (ladder sampler, SEE, coach, rng, elo stats)
src/engine/ UCI adapters: browser Worker, Node (eval)
src/ui/     board, pieces, realms, lessons, panels
eval/       match runner, CPL labeller, coach evaluation, baselines, report writer
docs/       this file, generated results
```
`src/core` has no DOM and no engine dependency, so the same code runs in the browser, the unit tests and the eval harness.

## 6. Limits stated in advance
- The anchor scale is not a human rating scale. Mapping to Lichess or Chess.com ratings is unvalidated.
- The 3% to 15% blunder band for M3 is an assumption, not measured from human games.
- Stockfish lite is the ground truth for CPL; its evaluation errors become label noise.
- A browser engine on a slow phone will take longer than the Node numbers in M5.
- Free hosting: static files only, no accounts, no server state. Progress is stored in `localStorage`.
