# Evaluation results

Profile: quick. Run status: completed.
Rating intervals: 400-game percentile bootstrap; fixed anchors are UCI Elo 1320, 1900 and 2600 at a 5,000-node budget.

## Ladder ratings

| Level | Rating | 95% CI |
|---|---:|---:|
| L1 | 1048 | 879-1157 |
| L2 | 1146 | 1006-1251 |
| L3 | 1324 | 1154-1464 |
| L4 | 1565 | 1420-1720 |
| L5 | 1771 | 1600-1951 |
| L6 | 2145 | 1942-2391 |
| L7 | 2331 | 2107-2584 |
| L8 | 6152 | 5980-6189 |

## M1 adjacent pairs

| Pair | Score | Wilson 95% | Games | Pass |
|---|---:|---:|---:|---|
| L2 over L1 | 66.7% | 39.1-86.2% | 12 | no |
| L3 over L2 | 66.7% | 39.1-86.2% | 12 | no |
| L4 over L3 | 83.3% | 55.2-95.3% | 12 | yes |
| L5 over L4 | 70.8% | 42.8-88.7% | 12 | no |
| L6 over L5 | 79.2% | 50.9-93.3% | 12 | yes |
| L7 over L6 | 75.0% | 46.8-91.1% | 12 | no |
| L8 over L7 | 100.0% | 75.7-100.0% | 12 | yes |

## M2 anchors

| Match | Score | Wilson 95% | Pass |
|---|---:|---:|---|
| L1 vs UCI Elo 1320 | 16.7% | 4.7-44.8% | no |
| L8 vs UCI Elo 1900 | 100.0% | 75.7-100.0% | yes |

## M3 blunders

| Player | Games | Moves | Blunders | Rate | Hung share |
|---|---:|---:|---:|---:|---:|
| L2 | 42 | 268 | 29 | 10.8% | 62.1% |
| L1 | 87 | 290 | 31 | 10.7% | 71.0% |
| L3 | 42 | 271 | 25 | 9.2% | 76.0% |
| L4 | 42 | 287 | 31 | 10.8% | 71.0% |
| elo1320 | 72 | 286 | 24 | 8.4% | 37.5% |
| random | 12 | 227 | 15 | 6.6% | 53.3% |
| minimax | 12 | 209 | 20 | 9.6% | 40.0% |
| skill0 | 12 | 235 | 26 | 11.1% | 38.5% |

## M4 coach

| Method | Label | Pairs | Precision | Recall |
|---|---|---:|---:|---:|
| coach-see | B | 400 | 73.8% | 75.2% |
| coach-moved-piece-only | B | 400 | 80.3% | 36.3% |
| coach-see-without-defender-count | B | 400 | 69.3% | 77.7% |
| coach-without-pinned-piece-rule | B | 400 | 73.8% | 75.2% |
| warn-if-attacked | B | 400 | 67.6% | 46.5% |
| never-warn | B | 400 | 0.0% | 0.0% |
| coach-see | A | 400 | 18.1% | 56.9% |
| coach-moved-piece-only | A | 400 | 23.9% | 33.3% |
| coach-see-without-defender-count | A | 400 | 17.6% | 60.8% |
| coach-without-pinned-piece-rule | A | 400 | 18.1% | 56.9% |
| warn-if-attacked | A | 400 | 21.3% | 45.1% |
| never-warn | A | 400 | 0.0% | 0.0% |

## M5 cost

- {"p95Ms":1210.9363000000594,"samples":[1044.3867999999784,1108.9964000000618,1125.1846999999834,1159.4477999999654,1183.4120000000112,1203.0596000000369,1210.5105000000913,1210.9363000000594],"bundleBytes":1885306,"bundleCheck":"pass"}

## Pass/fail summary

| Metric | Pass | Value | Threshold |
|---|---|---|---|
| M1 | no | 3/7 adjacent pairs | all >=60% and Wilson low >50% |
| M2 | no | false/true | L1 <=10%; L8 >=60% |
| M3 | yes | [object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object] | L1-L4 blunder rate 3%-15%; hung share >=60% |
| M4 | no | [object Object] | Label B precision >=0.85; recall >=0.60 |
| M5 | yes | [object Object] | p95 <=1500ms; bundle <=6MB |

## Error analysis

### False positives

| FEN | Move | Reference CPL | Material loss | PV |
|---|---|---:|---:|---|
| r2qkbr1/2p1np2/p2p1n2/1p1Pp1pp/4P3/NPP1BPPB/P3N3/1R1Q1RK1 b q - 1 17 | e7g6 | 165 | 0 | e3g5 f8e7 g1h2 f6e4 f3e4 e7g5 |
| r3k1nr/3n1ppp/3p4/3Pp3/P1b5/4qN1P/1P6/1RK1b3 w kq - 0 22 | c1c2 | 0 | 0 | c4b3 |
| 8/3pk3/2b4p/1BP4P/4p3/R3P3/3K4/2q3r1 w - - 2 63 | d2e2 | 0 | 0 | g1g2 |
| r6k/7r/P6P/4P2P/8/2P4n/8/3K4 w - - 11 61 | d1c1 | 53 | 0 | h3f4 c1b2 h7a7 c3c4 |
| r2r2k1/pb2bppp/1p2p3/PPp1n3/2P1Pq2/2N2N1P/R1Q1BPP1/4K2R w K - 1 19 | f3e5 | 16 | 0 | f4e5 a5a6 |
| B1b4r/p1pp1k2/4p2p/3n4/8/BP2P1P1/P1qP1P1P/RN2K2R w Q - 1 15 | a8d5 | 0 | 0 | e6d5 b1c3 |
| r3kb1r/pb1p1pQp/4pn2/2p5/4P3/2q5/PPPP1PPP/R1B1K1NR w KQkq - 0 8 | g7h8 | 0 | -500 | c3e5 d2d3 |
| 8/R7/3B1R2/1p2k1P1/1P5p/1KN3P1/5P2/8 b - - 0 35 | e5d4 | 0 | 0 | d6c5 d4d3 a7d7 |
| r3k2r/p2nn3/2p2p2/7p/3PN3/2P3BP/p5P1/R5K1 b - - 2 26 | h5h4 | 15 | 0 | g3h2 e8f7 c3c4 f7g6 e4c3 a7a5 c3a4 c6c5 a4c5 d7c5 d4c5 e7c6 |
| rn2k1nr/1p2pp1p/3p2p1/2p5/p3PP2/2P3P1/R1PQN1BP/2B1K2R b Kkq - 0 12 | a4a3 | 0 | 0 | d2d1 g8h6 e1g1 b8d7 e4e5 h6f5 e5d6 h7h5 |

### False negatives

| FEN | Move | Reference CPL | Material loss | PV |
|---|---|---:|---:|---|
| 6nr/2p1qkpp/3pp3/8/Np3B2/2P3P1/1P2PPbP/3K4 w - - 0 18 | d1e1 | 0 | 300 | g2c6 a4c5 d6c5 f4e5 g8f6 e5f6 e7f6 f2f3 e6e5 c3b4 c5b4 f3f4 |
| 2q5/2P3kp/5p2/1P4p1/K1Q1P3/1B3PP1/7P/5r2 b - - 6 52 | f1b1 | 432 | 100 | c4f7 g7h6 f7f6 h6h5 b3f7 |
| 8/8/3k4/r5p1/7p/1K5P/8/8 w - - 48 91 | b3c2 | 14 | 100 | g5g4 c2d1 g4h3 d1c2 a5d5 |
| 2b1kbnr/2q2ppp/BPpp4/4n1N1/3pPB2/1Q6/1P3PPP/R2K3R b k - 0 16 | c7d8 | 0 | 300 | a6c8 f8e7 f4e5 e7g5 a1a7 d8c8 |
| 3k1b2/8/8/8/K7/p7/8/5b2 w - - 8 97 | a4a5 | 409 | 800 | a3a2 a5a4 a2a1q a4b3 a1b1 b3c3 f8h6 c3d4 h6g7 d4d5 |
| 4n3/8/2kb2P1/4r1K1/Pp6/8/1P6/8 w - - 1 43 | g5h6 | 123 | 100 | d6f8 g6g7 f8g7 h6g6 g7f8 b2b3 f8d6 g6f7 e5f5 f7g6 f5f8 a4a5 f8f6 g6g5 |
| 5bnr/3kpppp/3n4/p2P2P1/P3P3/3K1P1N/1q5P/7R w - - 5 30 | f3f4 | 0 | 100 | b2b3 d3d2 d6e4 d2e2 e4c3 e2f2 b3b6 f2g3 b6e3 g3g4 h7h5 g4h4 e3b6 h4g3 h5h4 g3g4 |
| 8/8/7P/4Bp2/8/p2k1KP1/5P2/8 b - - 3 66 | d3c2 | 78 | 400 | h6h7 f5f4 h7h8r c2d2 h8h1 f4g3 f3g3 |
| r4k2/1p5r/2b2q1p/5p1p/5P2/pPN1RP2/P5P1/4KB2 w - - 0 28 | e3e5 | 0 | 100 | f6h4 e1e2 h4f4 e5e6 f4d4 c3e4 f5e4 f3e4 d4b2 e2e1 |
| r3k1r1/1p3ppp/pP2p3/2n5/b1N5/3P1N1P/4P3/2K2B1n w q - 0 21 | f3e5 | 91 | 100 | h1g3 f1g2 g3e2 c1b2 f7f6 c4a5 f6e5 g2b7 c5b7 a5b7 e8e7 b7a5 g8d8 |