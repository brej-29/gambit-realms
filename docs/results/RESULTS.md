# Evaluation results

Profile: full. Run status: completed.
Rating intervals: 400-game percentile bootstrap; fixed anchors are UCI Elo 1320, 1900 and 2600 at a 5,000-node budget.

## Ladder ratings

| Level | Rating | 95% CI |
|---|---:|---:|
| L1 | 950 | 912-986 |
| L2 | 1138 | 1089-1183 |
| L3 | 1338 | 1294-1391 |
| L4 | 1641 | 1589-1687 |
| L5 | 1835 | 1782-1886 |
| L6 | 2017 | 1959-2070 |
| L7 | 2253 | 2177-2325 |
| L8 | 2600 | 2600-2600 |

## M1 adjacent pairs

| Pair | Score | Wilson 95% | Games | Pass |
|---|---:|---:|---:|---|
| L2 over L1 | 70.8% | 64.1-76.6% | 200 | yes |
| L3 over L2 | 73.3% | 66.7-78.9% | 200 | yes |
| L4 over L3 | 83.5% | 77.7-88.0% | 200 | yes |
| L5 over L4 | 73.5% | 67.0-79.1% | 200 | yes |
| L6 over L5 | 72.5% | 65.9-78.2% | 200 | yes |
| L7 over L6 | 78.0% | 71.8-83.2% | 200 | yes |
| L8 over L7 | 99.8% | 97.7-100.0% | 200 | yes |

## M2 anchors

| Match | Score | Wilson 95% | Pass |
|---|---:|---:|---|
| L1 vs UCI Elo 1320 | 7.5% | 4.6-12.0% | yes |
| L8 vs UCI Elo 1900 | 100.0% | 98.1-100.0% | yes |

## M3 blunders

| Player | Games | Moves | Blunders | Rate | Hung share |
|---|---:|---:|---:|---:|---:|
| L2 | 503 | 1485 | 138 | 9.3% | 64.5% |
| L1 | 1017 | 1485 | 171 | 11.5% | 74.9% |
| L3 | 515 | 1440 | 133 | 9.2% | 56.4% |
| L4 | 516 | 1455 | 145 | 10.0% | 46.9% |
| elo1320 | 674 | 1440 | 149 | 10.3% | 28.9% |
| random | 198 | 1331 | 121 | 9.1% | 61.2% |
| minimax | 198 | 1492 | 117 | 7.8% | 29.9% |
| skill0 | 199 | 1428 | 155 | 10.9% | 23.2% |

## M4 coach

| Method | Label | Pairs | Precision | Recall |
|---|---|---:|---:|---:|
| coach-see | B | 5000 | 64.8% | 75.4% |
| coach-moved-piece-only | B | 5000 | 72.7% | 36.2% |
| coach-see-without-defender-count | B | 5000 | 59.2% | 77.3% |
| coach-without-pinned-piece-rule | B | 5000 | 64.8% | 75.4% |
| warn-if-attacked | B | 5000 | 56.6% | 43.3% |
| never-warn | B | 5000 | 0.0% | 0.0% |
| coach-see | A | 5000 | 24.5% | 63.1% |
| coach-moved-piece-only | A | 5000 | 37.7% | 41.6% |
| coach-see-without-defender-count | A | 5000 | 22.7% | 65.7% |
| coach-without-pinned-piece-rule | A | 5000 | 24.5% | 63.1% |
| warn-if-attacked | A | 5000 | 29.3% | 49.8% |
| never-warn | A | 5000 | 0.0% | 0.0% |

## M5 cost

- {"p95Ms":1282.7601000000723,"samples":[1006.6334000001661,1043.031299999915,1069.260200000368,1104.5696999998763,1123.1384000000544,1134.0906000002287,1142.1033000000753,1152.7991000004113,1159.6440000003204,1161.9546999996528,1163.8339999997988,1167.3260999997146,1181.3675000001676,1197.8318999996409,1205.476200000383,1214.2444000001997,1220.4717999999411,1223.909500000067,1282.7601000000723,1312.8935000002384],"bundleBytes":2479733,"bundleCheck":"pass"}

## Pass/fail summary

| Metric | Pass | Value | Threshold |
|---|---|---|---|
| M1 | yes | 7/7 adjacent pairs | all >=60% and Wilson low >50% |
| M2 | yes | true/true | L1 <=10%; L8 >=60% |
| M3 | no | [object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object] | L1-L4 blunder rate 3%-15%; hung share >=60% |
| M4 | no | [object Object] | Label B precision >=0.85; recall >=0.60 |
| M5 | yes | [object Object] | p95 <=1500ms; bundle <=6MB |

## Error analysis

### False positives

| FEN | Move | Reference CPL | Material loss | PV |
|---|---|---:|---:|---|
| qk6/8/6p1/Pp6/5p1p/8/5K2/8 w - - 14 69 | f2f1 | 0 | 0 | a8e4 a5a6 f4f3 a6a7 b8a7 f1g1 e4e2 g1h1 e2g2 |
| 1nbqk2r/r3p1pp/1p1p3n/pp1PP3/P7/1P3N2/2P3P1/R1B1KB1R b KQ - 0 16 | d6e5 | 0 | -100 | c1b2 b5a4 a1a4 h8f8 a4c4 h6f7 c4c8 d8c8 f1b5 e8d8 |
| r1b1kb1r/pp3ppp/2n5/3pp2P/P3B3/2Ppn3/4PK2/qN4NR b kq - 1 16 | a1b1 | 0 | -200 | g1h3 b1b6 e4d3 e5e4 d3b5 f8e7 b5c6 b7c6 h5h6 e7h4 f2g1 g7g6 h3f4 e3f5 g1g2 |
| 4k3/2N5/3K4/2p5/2P5/8/7R/8 b - - 44 102 | e8d8 | 64 | 0 | h2h8 |
| 8/Q3B1p1/4p3/7p/p1P5/P5P1/1P1k1R2/5K2 b - - 12 40 | d2d3 | 0 | 0 | a7d7 d3e4 f2f4 e4e3 e7c5 |
| r3k3/1Q3pp1/p2Bp3/8/8/8/P6r/3RKB1R b Kq - 0 22 | a8a7 | 0 | 0 | b7c8 |
| r3k2r/p1p1bp1p/2p2n2/q7/2P3PP/3P4/P3NP2/R3KB1R w kq - 10 22 | e1d1 | 0 | -300 | f6e4 d3e4 e8c8 e2d4 d8d4 d1e2 a5c3 h1h3 c3a1 h3d3 d4d3 e2d3 h8d8 d3c2 a1d1 c2c3 d1f1 c4c5 d8d3 c3c4 |
| rnb1k1nr/ppq2ppp/2pb4/P2pp3/2P5/1Q2P2N/1B1P1PPP/RN2KB1R b KQkq - 0 8 | d5c4 | 0 | -300 | f1c4 c8h3 |
| r2qkb1r/1pp2ppp/p1n1b1n1/P3p1P1/3p4/1PP5/3PPP1P/RNBQKBNR w KQkq - 0 10 | c3d4 | 163 | -300 | c6d4 a1a4 f8d6 a4d4 e5d4 g1f3 e6d5 e2e3 d8e7 f1c4 d5c4 f3d4 c4d5 |
| rnb1kb1r/pp3p2/2p2n1p/2pq2p1/3P3N/1Q2P3/PP1B1PPP/R3KB1R w KQkq - 2 13 | f1c4 | 0 | 0 | d5d7 h4f3 b7b5 f3e5 b5c4 e5d7 c4b3 d7f6 e8e7 f6e4 c5d4 a2b3 f7f5 e4g3 e7f7 f2f4 |

### False negatives

| FEN | Move | Reference CPL | Material loss | PV |
|---|---|---:|---:|---|
| 8/5k2/8/8/3K4/p7/8/3r4 w - - 4 68 | d4e3 | 0 | 800 | a3a2 e3e2 a2a1q e2e3 a1c3 e3f4 d1d4 f4g5 c3c5 g5h6 d4h4 |
| 8/k1PK4/8/8/8/8/8/8 b - - 4 87 | a7a6 | 0 | 800 | c7c8q a6b5 c8c2 b5b4 d7c6 b4a3 c2b1 a3a4 b1b2 a4a5 b2b5 |
| 7K/2k5/8/3n4/2n5/1p6/8/8 w - - 7 104 | h8h7 | 0 | 800 | b3b2 h7h6 b2b1q h6h5 b1e4 h5g5 c4e5 g5h5 e4g6 h5h4 g6g4 |
| 2k1r3/p1b5/8/1p5p/7P/PK2p3/8/8 w - - 0 44 | b3c3 | 0 | 700 | e3e2 c3b4 e2e1q b4b5 e1e4 a3a4 e8e5 b5a6 e4a4 |
| 8/4K1P1/8/8/8/8/8/1B2k3 b - - 56 115 | e1d1 | 0 | 800 | g7g8q d1d2 g8b3 d2e1 e7e6 e1e2 e6e5 e2f2 b3d3 f2g2 e5d4 g2f2 d3h3 f2e2 h3g2 e2d1 d4d3 d1e1 g2e2 |
| 1R6/2P5/8/2K5/8/4k3/8/8 b - - 20 103 | e3d3 | 0 | 800 | b8e8 d3c3 c7c8q c3c2 c5b4 c2b2 e8e1 b2a2 c8c2 |
| r1b1k1nr/pppp1ppp/n3p3/6q1/1bP5/8/P2PPP1P/RNBQKBNR w KQkq - 0 5 | e2e4 | 254 | 500 | g5e5 g1e2 e5a1 e2c3 b4c3 b1c3 a6b4 c3b5 b4a2 c1a3 a1d1 e1d1 e8d8 h1g1 d7d6 b5d6 c7d6 g1g7 |
| 8/5k2/5p2/b5p1/5p2/5P1p/6r1/2K5 w - - 6 88 | c1d1 | 0 | 800 | h3h2 d1c1 h2h1q |
| 8/8/p7/5Qp1/1P5k/5p2/3P1K2/8 b - - 3 40 | g5g4 | 0 | 100 | f5g6 g4g3 f2f3 h4h3 g6g3 |
| 8/1P6/1B3P2/2K5/8/8/2k5/8 b - - 4 77 | c2b2 | 0 | 800 | c5c4 b2c1 b7b8q c1d2 b8h2 d2d1 c4d3 d1c1 h2c2 |