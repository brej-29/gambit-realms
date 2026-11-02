# Evaluation results

Profile: quick. Run status: completed.
Rating intervals: 400-game percentile bootstrap; fixed anchors are UCI Elo 1320 and UCI Elo 1900.

## Ladder ratings

| Level | Rating | 95% CI |
|---|---:|---:|
| L1 | 1231 | 1040-1409 |
| L2 | 1569 | 1320-4749 |
| L3 | 1907 | 1572-5267 |
| L4 | 2246 | 1821-8209 |
| L5 | 2790 | 2356-8958 |
| L6 | 3128 | 2728-11609 |
| L7 | 3466 | 3058-12153 |
| L8 | 3746 | 3303-12570 |

## M1 adjacent pairs

| Pair | Score | Wilson 95% | Games | Pass |
|---|---:|---:|---:|---|
| L2 over L1 | 87.5% | 59.8-97.1% | 12 | yes |
| L3 over L2 | 87.5% | 59.8-97.1% | 12 | yes |
| L4 over L3 | 87.5% | 59.8-97.1% | 12 | yes |
| L5 over L4 | 95.8% | 69.9-99.6% | 12 | yes |
| L6 over L5 | 87.5% | 59.8-97.1% | 12 | yes |
| L7 over L6 | 87.5% | 59.8-97.1% | 12 | yes |
| L8 over L7 | 83.3% | 55.2-95.3% | 12 | yes |

## M2 anchors

| Match | Score | Wilson 95% | Pass |
|---|---:|---:|---|
| L1 vs UCI Elo 1320 | 37.5% | 16.5-64.6% | no |
| L8 vs UCI Elo 1900 | 100.0% | 75.7-100.0% | yes |

## M3 blunders

| Player | Games | Moves | Blunders | Rate | Hung share |
|---|---:|---:|---:|---:|---:|
| L1 | 72 | 3991 | 503 | 12.6% | 15.7% |
| L2 | 24 | 1425 | 129 | 9.1% | 18.6% |
| L3 | 24 | 1345 | 65 | 4.8% | 15.4% |
| L4 | 24 | 1424 | 38 | 2.7% | 15.8% |
| elo1320 | 24 | 1448 | 196 | 13.5% | 14.8% |
| random | 12 | 325 | 28 | 8.6% | 67.9% |
| minimax | 12 | 434 | 89 | 20.5% | 15.7% |
| skill0 | 12 | 968 | 114 | 11.8% | 18.4% |

## M4 coach

| Method | Label | Pairs | Precision | Recall |
|---|---|---:|---:|---:|
| coach-see | B | 400 | 62.5% | 19.7% |
| coach-see-without-defender-count | B | 400 | 44.9% | 31.6% |
| coach-without-pinned-piece-rule | B | 400 | 62.5% | 19.7% |
| warn-if-attacked | B | 400 | 43.8% | 32.2% |
| never-warn | B | 400 | 0.0% | 0.0% |
| coach-see | A | 400 | 29.2% | 17.7% |
| coach-see-without-defender-count | A | 400 | 29.0% | 39.2% |
| coach-without-pinned-piece-rule | A | 400 | 29.2% | 17.7% |
| warn-if-attacked | A | 400 | 28.6% | 40.5% |
| never-warn | A | 400 | 0.0% | 0.0% |

## M5 cost

- {"p95Ms":655.2710000000006,"samples":[554.3912000000055,565.045299999998,575.4697999999989,578.7862000000023,588.3187000000034,608.0152999999991,637.2571000000025,655.2710000000006],"bundleBytes":1885306,"bundleCheck":"pass"}

## Pass/fail summary

| Metric | Pass | Value | Threshold |
|---|---|---|---|
| M1 | yes | 7/7 adjacent pairs | all >=60% and Wilson low >50% |
| M2 | no | false/true | L1 <=10%; L8 >=60% |
| M3 | no | [object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object] | L1-L4 blunder rate 3%-15%; hung share >=60% |
| M4 | no | [object Object] | Label B precision >=0.85; recall >=0.60 |
| M5 | yes | [object Object] | p95 <=1500ms; bundle <=6MB |

## Error analysis

### False positives

| FEN | Move | Reference CPL | Material loss | PV |
|---|---|---:|---:|---|
| r3kb1r/pbpq2pp/1p1pp2n/n3PpN1/2PP1P2/P5P1/1P3KBP/RNBQ3R w kq - 4 12 | g2b7 | 0 | 0 | a5b7 b1c3 |
| 2r1kb1r/5pp1/p1b1p3/1pp1B2p/2P4q/P2P4/1P3PPP/RN1QKBNR w KQk - 0 15 | c4b5 | 117 | 0 | a6b5 b1d2 f8d6 e5g3 d6g3 f2g3 h4d4 g1f3 c6f3 d2f3 |
| r2k3r/qbp3pp/p4p2/1B1np3/1nP1N3/1P3P2/1B3RPP/R2Q2K1 w - - 3 19 | c4d5 | 18 | -500 | d8c8 b5c4 b7d5 c4d5 h8d8 g1h1 d8d5 d1f1 b4d3 f2d2 f6f5 d2d3 d5d3 f1d3 |
| r4q1k/7p/2p1b1p1/4p3/p2n4/P2Q1P2/1P2NPBP/2b1R2K w - - 0 28 | e2d4 | 90 | -300 | f8d6 g2f1 |
| 2kr4/pp3ppn/2p4r/P2p1P2/2PPp2p/4P2P/3nBP2/1qRK2NR w - - 4 24 | g1f3 | 357 | -300 | b1b3 d1d2 b3a2 d2d1 e4f3 e2d3 a2a4 c1c2 a4a1 c2c1 a1a5 c4c5 a5c7 c1a1 |
| 3r1r2/pk5p/1p1N4/1Pp1BbPB/P4p2/nR4bP/3P4/3K2R1 b - - 3 37 | d8d6 | 20 | -300 | e5d6 f5c2 d1e2 c2b3 h5f3 b7c8 d6f8 b3a4 f3g4 c8d8 g1a1 a4b5 e2d1 d8e8 f8g7 b5a4 d1c1 |
| 2rqkb1r/1b1pnpp1/Bpn5/4p1Pp/P4P1P/1p2P2N/1PPP4/RNBQK3 b Qk - 0 13 | b3c2 | 24 | -600 | a6b7 c2d1r e1d1 c8c7 b7a6 c6b4 a6f1 d8a8 b1a3 a8f3 d1e1 |
| 5r1r/4k1p1/n1pp2n1/1p3bP1/p4P2/P2BB2p/1PPR3P/2K3R1 w - - 2 24 | d3f5 | 48 | 0 | f8f5 e3b6 e7d7 g1d1 |
| 2r1kbnr/p1pqpppp/8/6B1/1P2B2P/P1N3P1/2Q1NP2/3RK2R w Kk - 0 25 | d1d7 | 0 | -900 | g8f6 g5f6 g7f6 e4c6 e7e6 d7d2 e8e7 d2d1 f6f5 |
| 7R/1B1bkpp1/1Rnr4/2r1p1P1/7p/P1pPP3/2P1KP2/8 b - - 3 39 | e5e4 | 0 | -100 | b7a6 h4h3 h8h4 c5g5 a6b5 e4d3 c2d3 |

### False negatives

| FEN | Move | Reference CPL | Material loss | PV |
|---|---|---:|---:|---|
| r3k3/2Bn2pr/p1q1pb2/Qp1b4/8/P6P/1PP1BP2/1K1R2R1 w q - 0 30 | c7f4 | 0 | 100 | h7h3 f4g5 e8f7 a5d2 a8h8 g1g3 h3g3 |
| 8/3k4/3p4/2pP4/7p/2BK3P/p5P1/3rr3 w - - 2 71 | c3d2 | 0 | 600 | a2a1q d3c2 d1d2 c2d2 a1c1 d2d3 e1e3 |
| 2n2br1/1rpkp1p1/1p6/3q1N1Q/P3NB1P/4R1P1/5P2/4R1K1 b - - 2 36 | c8a7 | 0 | 400 | e1d1 d5d1 h5d1 d7c8 e3c3 e7e6 f5d6 c8b8 |
| r1br2k1/pp3p2/2n3p1/1qp5/4pp2/P2pnP2/2P3PP/b1KR4 b - - 1 25 | a1c3 | 0 | 100 | f3e4 b5b2 |
| 1k6/7P/8/p2P4/P3p2R/2R1B1P1/1P3P2/5K2 b - - 0 44 | b8b7 | 0 | 800 | h7h8q b7a6 h8a8 |
| 4r1k1/p1b1P2p/2P3p1/4n3/7P/6P1/3r2K1/2R5 w - - 1 38 | g2h3 | 0 | 100 | e8e7 c1c3 d2d3 c3c1 d3d4 c1a1 e5c6 a1c1 c6e5 |
| 7q/5k1P/8/1p1b2K1/8/8/n7/8 w - - 3 95 | g5h4 | 0 | 100 | h8h7 h4g3 h7g7 g3h4 g7f6 h4g3 f6c3 g3h4 |
| rq3k1r/p1Npbpp1/2b1pn1p/2p5/P1P5/1P2PP2/1B2N1PP/R3KB1R w - - 0 19 | b2e5 | 0 | 300 | d7d6 e5b2 b8c7 e2c3 c7b8 e3e4 c6d7 b2c1 d7e8 c1d2 |
| 8/pk5p/1p1B4/1Pp3PB/P7/n5RP/2bP2p1/4Kr2 w - - 2 42 | e1e2 | 20 | 200 | c2d1 e2d3 d1h5 g3g2 h5g6 d3e2 f1f7 e2d1 a3c4 d6g3 c4b2 d1c1 b2d3 c1d1 g6h5 d1c2 |
| 2q1kbnr/3Nppp1/1Bp1P3/p6p/Q7/2P3P1/PP1N1P1P/2KR1B1R w k - 1 19 | f1e2 | 0 | 100 | f7e6 d7e5 g8f6 e2d3 h8h6 b6e3 f6d7 e3h6 d7e5 |