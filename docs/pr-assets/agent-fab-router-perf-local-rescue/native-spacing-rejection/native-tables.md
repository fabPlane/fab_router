# Fresh paired native measurements

Same 26 frozen cases, three repeats per source, host and cores 12–19. Recovery enabled in both modes. Same production baseline with exactly four corner-offset replacements in the isolated candidate. Sequential sweeps, no overlapping own heavy jobs; shared-host timing is observational.

| Native mode | Passed /78 | Valid /26 | Opens | Known new errors | Median / p95 s | Total s | Vias | Length sum mm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Global proposal offset | 48 | 16 | 90 | 27 | 1.121267 / 16.712702 | 410.624294 | 2826 | 60450.378202 |
| Obstacle kind/sheet proposal offset | 48 | 16 | 93 | 33 | 1.137373 / 18.204223 | 411.166979 | 2826 | 60736.359758 |

Unchanged sessions: 57/78. Structured-error, warning-geometry, fidelity and completion regressions: 6. Existing errors remain unresolved; the suite is not DRC clean.

Three repeats per case. p95 for three observations is their maximum; opens/errors/vias/length are totals over the same three attempts.

| Case | Passed before→after /3 | Opens | Errors | Vias | Length sum mm | Median s before→after | p95 s before→after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fan-controller-fan-controller-j1 | 0→0 | 12→12 | 0→0 | 306→306 | 2883.013→2768.763 | 4.788394→4.744242 | 4.919804→4.809038 |
| fan-controller-fan-controller-j2-large | 3→3 | 0→0 | 0→0 | 78→78 | 1685.579→1685.579 | 0.851234→0.850776 | 0.851956→0.904144 |
| fan-controller-fan-controller-j2-medium | 3→3 | 0→0 | 0→0 | 81→81 | 1595.992→1595.992 | 0.733617→0.714116 | 0.746622→0.734004 |
| fan-controller-fan-controller-j2-small | 0→0 | 3→3 | 0→0 | 66→66 | 1486.700→1486.700 | 3.822662→3.928149 | 4.570533→4.342697 |
| hellscribe-hellscribe-j1 | 0→0 | 9→9 | 0→0 | 300→300 | 3947.358→3947.358 | 3.708384→3.922282 | 3.858229→4.329052 |
| hellscribe-hellscribe-j2-large | 0→0 | 3→3 | 0→0 | 333→333 | 4107.846→4107.846 | 0.975414→1.014970 | 0.993963→1.033377 |
| kitspace-aquarius-j4 | 0→0 | 45→51 | 18→24 | 390→390 | 5193.339→5420.324 | 51.643776→49.878520 | 53.150905→50.960234 |
| kitspace-lcr-addon-j3 | 3→3 | 0→0 | 0→0 | 120→120 | 2536.458→2536.458 | 1.980447→2.190214 | 2.121891→2.262909 |
| kitspace-solenoid-driver-j1 | 3→3 | 0→0 | 0→0 | 36→36 | 1058.072→1058.072 | 0.716894→0.732317 | 0.740371→0.734928 |
| kitspace-solenoid-driver-j3 | 3→3 | 0→0 | 0→0 | 36→36 | 1062.529→1062.529 | 0.735767→0.723120 | 0.757988→0.743515 |
| kitspace-solenoid-driver-j4 | 3→3 | 0→0 | 0→0 | 27→27 | 719.054→719.054 | 0.722536→0.732772 | 0.725155→0.857587 |
| nextbusclock-nextbusclockv1-j2-large | 3→3 | 0→0 | 0→0 | 123→123 | 4566.178→4566.178 | 3.004928→3.263098 | 3.103783→3.349502 |
| nextbusclock-nextbusclockv1-j2-medium | 3→3 | 0→0 | 0→0 | 3→3 | 4452.316→4452.316 | 0.996453→1.154290 | 0.997389→1.178352 |
| nextbusclock-nextbusclockv1-j2-small | 3→3 | 0→0 | 0→0 | 6→6 | 4494.818→4494.818 | 0.731752→0.724306 | 0.793405→0.727223 |
| nextbusclock-nextbusclockv1-j3 | 0→0 | 3→6 | 0→0 | 195→195 | 4685.449→4411.988 | 9.025746→8.503114 | 11.210372→9.509853 |
| paperino-hw-paperino-shield-j4 | 0→0 | 12→6 | 0→0 | 3→3 | 845.376→1300.348 | 15.435796→17.225906 | 16.712702→18.204223 |
| photon-sprinkler-sprinkler-j1 | 3→3 | 0→0 | 0→0 | 36→36 | 2108.952→2104.958 | 12.271787→11.878846 | 12.930683→12.372914 |
| photon-sprinkler-sprinkler-j3 | 3→3 | 0→0 | 0→0 | 36→36 | 2120.275→2116.281 | 15.284587→15.186316 | 15.522000→15.741878 |
| qrpcard-qrpcard-j1 | 3→3 | 0→0 | 0→0 | 177→177 | 2484.703→2484.703 | 1.367679→1.358903 | 1.523362→1.359061 |
| qrpcard-qrpcard-j2-medium | 3→3 | 0→0 | 0→0 | 60→60 | 1418.744→1418.744 | 0.879544→0.842115 | 0.920321→0.872033 |
| qrpcard-qrpcard-j2-small | 0→0 | 0→0 | 6→6 | 51→51 | 1441.299→1441.299 | 0.774041→0.757406 | 0.781999→0.864578 |
| qrpcard-qrpcard-j4 | 0→0 | 0→0 | 3→3 | 114→114 | 1569.597→1569.597 | 0.967871→0.976640 | 1.270153→1.156176 |
| rufs-smart-psu-j1 | 3→3 | 0→0 | 0→0 | 81→81 | 1162.303→1162.303 | 0.723251→0.724596 | 0.874818→0.851955 |
| rufs-smart-psu-j3 | 0→0 | 3→3 | 0→0 | 78→78 | 1137.054→1137.054 | 2.149522→2.283029 | 2.803433→2.317691 |
| rufs-smart-psu-j4 | 3→3 | 0→0 | 0→0 | 48→48 | 1015.152→1014.874 | 1.134168→1.105681 | 1.234880→1.120455 |
| sv650sds-sds-tool-j4 | 3→3 | 0→0 | 0→0 | 42→42 | 672.225→672.225 | 0.860013→0.855326 | 1.099224→0.861765 |
