# Evaluation results

Profile: quick. Seeds are deterministic and reporting starts at 10000.
Full profile status: attempted; Stockfish lite WASM aborts at the registered 300000-node reference limit on this Node 24 environment.

## Ladder ratings

| Level | Rating | 95% CI |
|---|---:|---:|
| L1 | 2273 | 2213–2333 |
| L2 | 27 | -33–87 |
| L3 | 980 | 920–1040 |
| L4 | 1933 | 1873–1993 |
| L5 | 2887 | 2827–2947 |
| L6 | 3840 | 3780–3900 |
| L7 | 4793 | 4733–4853 |
| L8 | 4147 | 4087–4207 |

## M1 adjacent pairs

| Pair | Score | Wilson 95% | Games | Pass |
|---|---:|---:|---:|---|
| L2 over L1 | 0.0% | 0.0–79.3% | 1 | no |
| L3 over L2 | 100.0% | 20.7–100.0% | 1 | no |
| L4 over L3 | 100.0% | 20.7–100.0% | 1 | no |
| L5 over L4 | 100.0% | 20.7–100.0% | 1 | no |
| L6 over L5 | 100.0% | 20.7–100.0% | 1 | no |
| L7 over L6 | 100.0% | 20.7–100.0% | 1 | no |
| L8 over L7 | 50.0% | 5.5–94.5% | 1 | no |

## M2 anchors

| Match | Score | Wilson 95% | Pass |
|---|---:|---:|---|
| L1 vs UCI Elo 1320 | 100.0% | 20.7–100.0% | no |
| L8 vs UCI Elo 1900 | 100.0% | 20.7–100.0% | yes |

## M3 blunders

| Player | Moves | Blunders | Rate | Hung share |
|---|---:|---:|---:|---:|
| L1 | 576 | 62 | 10.8% | 11.3% |
| L2 | 145 | 11 | 7.6% | 27.3% |
| L3 | 76 | 3 | 3.9% | 0.0% |
| L4 | 107 | 4 | 3.7% | 25.0% |
| elo1320 | 225 | 26 | 11.6% | 26.9% |
| random | 64 | 6 | 9.4% | 50.0% |
| minimax | 56 | 18 | 32.1% | 16.7% |
| skill0 | 125 | 20 | 16.0% | 25.0% |

## M4 coach

| Method | Pairs | Precision | Recall |
|---|---:|---:|---:|
| coach-see | 100 | 0.0% | 0.0% |
| warn-if-attacked | 100 | 0.0% | 0.0% |
| never-warn | 100 | 0.0% | 0.0% |

## M5 cost

- Latency: {"p95Ms":652.8367000000144,"samples":[580.9244000000181,621.4500999999873,633.1349000000046,652.8367000000144],"bundleBytes":1885306,"bundleCheck":"pass"}.
- Bundle: 1885306 bytes when a dist directory is present.

## Pass/fail summary

| Metric | Pass | Value | Threshold |
|---|---|---|---|
| M1 | no | 0/7 adjacent pairs | all >=60% and Wilson low >50% |
| M2 | no | false/true | L1 <=10%; L8 >=60% |
| M3 | no | [object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object] | L1-L4 blunder rate 3%-15%; hung share >=60% |
| M4 | no | [object Object] | precision >=0.85; recall >=0.60; pairs >=5000 |
| M5 | yes | [object Object] | p95 <=1500ms; bundle <=6MB |

## Error analysis

### False positives

| FEN | Move | Reason |
|---|---|---|
| rn1qkbnr/1bpppppp/8/pp6/P3P3/5NP1/1PPP1P1P/RNBQKB1R b KQkq - 0 4 | b5a4 | SEE warned, reference label was negative |
| rn1qkb1r/1bpppppp/5n2/p7/R3P3/3P1NP1/1PP2P1P/1NBQKB1R b Kkq - 0 6 | e7e5 | SEE warned, reference label was negative |
| r2qk2r/2p1bpp1/1nnpb2p/BN2p3/R3P3/3P1NP1/1PP2PBP/Q1R3K1 b kq - 0 15 | c6a5 | SEE warned, reference label was negative |
| r2qk2r/4bpp1/1nppb2p/RN2p3/4P3/3P1NP1/1PP2PBP/Q1R3K1 w kq - 0 17 | a5a8 | SEE warned, reference label was negative |
| R1bqk2r/4bpp1/1npp3p/1N2p3/4P3/3P1NP1/1PP2PBP/Q1R3K1 w k - 1 18 | b5d6 | SEE warned, reference label was negative |
| 7r/2q1bp1k/1np1b2p/R3p3/2P1P1p1/3P2PP/5PB1/Q2R2NK w - - 1 31 | h3g4 | SEE warned, reference label was negative |
| 7r/5p1k/1Pp1b2p/4p2q/4P3/2Q2PP1/6B1/5RNK w - - 1 45 | g2h3 | SEE warned, reference label was negative |
| 1B6/5pk1/2p4p/4Q2q/4P3/5PPb/5R2/4r1NK b - - 0 50 | h5e5 | SEE warned, reference label was negative |
| 6k1/5p2/2p4p/4B3/4P3/5PPb/5R1K/4r1N1 b - - 2 52 | h3g4 | SEE warned, reference label was negative |

### False negatives

| FEN | Move | Reason |
|---|---|---|