# Multiple-witness experiment results

Production pour recovery remains unsupported; default off. No engine or consumer pin change. No speed claim.

## Synthetic recovery-only trials

Nine fixtures × three repeats/source, same host and cores. Each cell is opens per trial, identical on all three repeats. All 81 v2-matrix trials have zero exact violations, deterministic sessions and preserved pads/pours/keepouts. Every failed closure rolls back exactly. V1 produces identical synthetic sessions. This is not a native score.

| Fixture | Current | Nearest only | Multiple witnesses |
| --- | ---: | ---: | ---: |
| solid | 1 | 0 | 0 |
| hole | 1 | 0 | 0 |
| concave | 1 | 0 | 0 |
| keepout | 1 | 0 | 0 |
| nearest-blocked | 1 | 1 | 0 |
| disjoint-sheet | 1 | 1 | 1 |
| blocked | 1 | 1 | 1 |
| reverse | 1 | 0 | 0 |
| foreign | 1 | 0 | 0 |

Current closes 0/27, nearest-only 18/27, multiple-witness 21/27. Six intentionally blocked/disjoint-sheet trials remain open. The earlier completed seven-fixture baseline/witness batch contains 42 further fresh trials; all overlap sessions match. The intermediate nine-fixture batches contain 81 trials/source and use an absent-layer diagnostic in place of the final physical two-layer disjoint-sheet control. All overlapping sessions match. Total completed synthetic evaluations: 42 + 81 + 81 + 81 + 81 = 366. A prior invalid-fixture batch was stopped and is not a completed benchmark.

## Full frozen native suite

26 cases × three repeats/source, all recovery enabled. Same machine, cores 12–19, case order, real rules, runtime and checker; order current → v1 → v2. Heavy tests/stress jobs overlap; times are observations, not attributed speed differences. The 27 known native thermal errors remain unresolved.

| Metric | Current | V1 | V2 |
| --- | ---: | ---: | ---: |
| passed | 39 | 39 | 39 |
| opens | 99 | 99 | 99 |
| new_errors | 27 | 27 | 27 |
| median_s | 1.258063 | 1.211316 | 1.109480 |
| p95_s | 20.535352 | 19.155734 | 19.470516 |
| total_s | 486.827585 | 463.408857 | 416.172861 |
| vias | 2826 | 2826 | 2826 |
| length_mm | 60080.812022 | 60080.812022 | 60080.812022 |
| valid_cases_3of3 | 13 | 13 | 13 |

V1: identical sessions 78/78; per-attempt regression records 0. All regression records, including any negative result, are retained in the comparison JSON.

V2: identical sessions 78/78; per-attempt regression records 0. All regression records, including any negative result, are retained in the comparison JSON.

Per-case p95 is the maximum of three samples. Opens/errors are sums over three attempts.

| Case | Current median / p95 s | V1 median / p95 s | V2 median / p95 s | Opens current / v1 / v2 | Errors current / v1 / v2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| fan-controller-fan-controller-j1 | 5.463522 / 5.846040 | 5.505631 / 5.587292 | 5.146716 / 5.292878 | 12 / 12 / 12 | 0 / 0 / 0 |
| fan-controller-fan-controller-j2-large | 1.011924 / 1.030321 | 0.879825 / 0.932965 | 0.867483 / 0.903321 | 0 / 0 / 0 | 0 / 0 / 0 |
| fan-controller-fan-controller-j2-medium | 0.926628 / 1.164885 | 0.769495 / 1.025551 | 0.718710 / 0.720247 | 0 / 0 / 0 | 0 / 0 / 0 |
| fan-controller-fan-controller-j2-small | 4.557244 / 4.776428 | 4.548914 / 4.897319 | 3.877402 / 4.554182 | 3 / 3 / 3 | 0 / 0 / 0 |
| hellscribe-hellscribe-j1 | 4.746086 / 4.834736 | 4.465012 / 4.617996 | 3.666663 / 3.969388 | 9 / 9 / 9 | 0 / 0 / 0 |
| hellscribe-hellscribe-j2-large | 1.160354 / 1.192719 | 1.035090 / 1.129260 | 0.991509 / 1.011315 | 3 / 3 / 3 | 0 / 0 / 0 |
| kitspace-aquarius-j4 | 62.159239 / 64.687589 | 59.244085 / 60.901750 | 56.317942 / 58.129689 | 45 / 45 / 45 | 18 / 18 / 18 |
| kitspace-lcr-addon-j3 | 2.393275 / 2.488725 | 2.382778 / 2.705143 | 2.117164 / 2.296605 | 0 / 0 / 0 | 0 / 0 / 0 |
| kitspace-solenoid-driver-j1 | 0.918779 / 1.057302 | 0.738551 / 0.744819 | 0.719856 / 0.726387 | 0 / 0 / 0 | 0 / 0 / 0 |
| kitspace-solenoid-driver-j3 | 0.926858 / 0.984709 | 0.741682 / 0.747750 | 0.715967 / 0.745787 | 0 / 0 / 0 | 0 / 0 / 0 |
| kitspace-solenoid-driver-j4 | 0.910656 / 0.939982 | 0.737217 / 0.762559 | 0.713871 / 0.739802 | 0 / 0 / 0 | 0 / 0 / 0 |
| nextbusclock-nextbusclockv1-j2-large | 3.726329 / 3.730498 | 3.232897 / 3.283265 | 3.026489 / 3.191516 | 0 / 0 / 0 | 0 / 0 / 0 |
| nextbusclock-nextbusclockv1-j2-medium | 1.047591 / 1.065242 | 1.023151 / 1.036866 | 0.976579 / 0.981581 | 0 / 0 / 0 | 0 / 0 / 0 |
| nextbusclock-nextbusclockv1-j2-small | 0.895025 / 0.979972 | 0.879609 / 0.885438 | 0.722265 / 0.879021 | 0 / 0 / 0 | 0 / 0 / 0 |
| nextbusclock-nextbusclockv1-j3 | 10.031623 / 10.837237 | 9.679591 / 9.843407 | 8.127700 / 8.270000 | 3 / 3 / 3 | 0 / 0 / 0 |
| paperino-hw-paperino-shield-j4 | 19.901347 / 20.535352 | 18.048792 / 18.919710 | 16.160009 / 19.470516 | 12 / 12 / 12 | 0 / 0 / 0 |
| photon-sprinkler-sprinkler-j1 | 13.622894 / 14.300803 | 12.750709 / 13.022556 | 10.931640 / 11.657857 | 3 / 3 / 3 | 0 / 0 / 0 |
| photon-sprinkler-sprinkler-j3 | 18.115788 / 18.161093 | 17.794820 / 19.155734 | 13.671375 / 14.097804 | 3 / 3 / 3 | 0 / 0 / 0 |
| qrpcard-qrpcard-j1 | 1.666986 / 1.819404 | 1.434317 / 1.562116 | 1.368032 / 1.396870 | 0 / 0 / 0 | 0 / 0 / 0 |
| qrpcard-qrpcard-j2-medium | 0.919091 / 0.930707 | 0.873944 / 0.885841 | 0.836685 / 0.845269 | 0 / 0 / 0 | 0 / 0 / 0 |
| qrpcard-qrpcard-j2-small | 0.785816 / 0.789140 | 0.743886 / 0.772743 | 0.710620 / 0.715346 | 0 / 0 / 0 | 6 / 6 / 6 |
| qrpcard-qrpcard-j4 | 1.231164 / 1.284961 | 1.133250 / 1.139529 | 0.978442 / 1.117365 | 0 / 0 / 0 | 3 / 3 / 3 |
| rufs-smart-psu-j1 | 0.884413 / 0.904234 | 0.752047 / 0.905994 | 0.727792 / 0.729629 | 0 / 0 / 0 | 0 / 0 / 0 |
| rufs-smart-psu-j3 | 2.226685 / 2.322336 | 1.936392 / 2.041129 | 1.876558 / 2.021787 | 3 / 3 / 3 | 0 / 0 / 0 |
| rufs-smart-psu-j4 | 1.300083 / 1.491227 | 1.285599 / 1.400517 | 1.111577 / 1.377956 | 3 / 3 / 3 | 0 / 0 / 0 |
| sv650sds-sds-tool-j4 | 1.050312 / 1.088319 | 0.866218 / 0.876828 | 0.842707 / 0.848206 | 0 / 0 / 0 | 0 / 0 / 0 |

## Supplied larger inputs

One exploratory pair per input/prototype, fixed two-pass/600-second budgets, strict DRC, optimiser/fanout disabled, no necking. Not native scores or three-repeat timing studies.

| Source | Input | Opens current / probe | Seconds current / probe | Vias current / probe | Length mm current / probe | Pours | Same session |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| V1 | l2-cycle18.dsn | 21 / 22 | 22.297864 / 21.902386 | 51 / 51 | 1094.342601 / 1094.756419 | 0 / 0 | False |
| V1 | l3-cycle18.dsn | 153 / 153 | 210.143698 / 216.144934 | 93 / 93 | 1688.604896 / 1688.604896 | 0 / 0 | True |
| V1 | dense6-bga324.dsn | 190 / 190 | 188.979755 / 173.817831 | 266 / 266 | 2032.379268 / 2032.379268 | 0 / 0 | True |
| V2 | l2-cycle18.dsn | 21 / 21 | 23.622627 / 23.333726 | 51 / 51 | 1094.342601 / 1094.342601 | 0 / 0 | True |
| V2 | l3-cycle18.dsn | 153 / 153 | 215.286647 / 220.491176 | 93 / 93 | 1688.604896 / 1688.604896 | 0 / 0 | True |
| V2 | dense6-bga324.dsn | 190 / 190 | 175.468201 / 180.947582 | 266 / 266 | 2032.379268 / 2032.379268 | 0 / 0 | True |

L2 trace repeat: current 21 opens, v1 22, v2 21; all exact violations zero. V1 skips original zero-margin work and closes net 7 within its 100000-unit limit, changing later routability. V2 restores every one of the original 16 target traces (including expansions, trials and proposals) and the exact session. This rejects v1 and explains why ordinary point-anchor work is preserved.

## Prepared Dense6 native case

Three repeats/source, current versus v2, same fixed two-pass/600-second settings. Separate export from the supplied DSN above.

| Metric | Current | V2 |
| --- | ---: | ---: |
| passed | 0 | 0 |
| opens | [181, 181, 181] | [181, 181, 181] |
| new_errors | [0, 0, 0] | [0, 0, 0] |
| median_s | 197.464998884 | 184.10776199900002 |
| p95_s | 210.32430021800002 | 204.91655865899997 |
| vias | [315, 315, 315] | [315, 315, 315] |
| length_mm | [2317.561458085628, 2317.561458085628, 2317.561458085628] | [2317.561458085628, 2317.561458085628, 2317.561458085628] |
| engine_incomplete | [181, 181, 181] | [181, 181, 181] |
| timeouts | [False, False, False] | [False, False, False] |

Native Dense6 regression records: 0.
