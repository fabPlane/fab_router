# Independent production default-off control

Historical cycle31 versus fresh cycle39; same 26 cases × three repeats, same host and cores 12–19. This is a default-off invariance control, **not a comparison with the offline via probe**. Shared-host tests overlap the fresh sweep. Times are descriptive; no speed claim. The probe has no adopted engine revision.

| Default-off control | Passed /78 | Valid /26 | Opens | Known new errors | Median / p95 / total s | Vias | Length sum mm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Historical | 39 | 13 | 120 | 27 | 1.136190 / 17.026949 / 403.581081 | 2826 | 58809.321397 |
| Fresh | 39 | 13 | 120 | 27 | 1.244415 / 17.871579 / 404.189740 | 2826 | 58809.321397 |

All 78 session files are identical. All structured native finding geometry/multiplicity, warnings, fidelity, opens, pass status, via count and track lengths match. All steps exited zero without timeout. All effective settings have recovery disabled. The 27 known thermal errors remain unfixed; suite is not DRC clean. p95 is nearest rank (maximum for three repeats).

| Case | Passed before→after /3 | Opens | Errors | Vias | Length sum mm | Median s before→after | p95 s before→after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fan-controller-fan-controller-j1 | 0→0 | 15→15 | 0→0 | 306→306 | 2727.066104→2727.066104 | 3.959925→4.011816 | 4.038945→4.593233 |
| fan-controller-fan-controller-j2-large | 3→3 | 0→0 | 0→0 | 78→78 | 1685.579109→1685.579109 | 0.991782→0.860752 | 1.008599→0.876840 |
| fan-controller-fan-controller-j2-medium | 3→3 | 0→0 | 0→0 | 81→81 | 1595.991566→1595.991566 | 0.732362→0.723233 | 0.742253→0.726213 |
| fan-controller-fan-controller-j2-small | 0→0 | 3→3 | 0→0 | 66→66 | 1486.700097→1486.700097 | 3.491481→3.504456 | 3.772043→4.040763 |
| hellscribe-hellscribe-j1 | 0→0 | 9→9 | 0→0 | 300→300 | 3947.358168→3947.358168 | 2.158517→2.007931 | 2.164141→2.170063 |
| hellscribe-hellscribe-j2-large | 0→0 | 3→3 | 0→0 | 333→333 | 4107.845516→4107.845516 | 1.013806→1.369876 | 1.032586→1.651680 |
| kitspace-aquarius-j4 | 0→0 | 45→45 | 18→18 | 390→390 | 5193.339380→5193.339380 | 50.769026→52.194419 | 53.973187→56.249938 |
| kitspace-lcr-addon-j3 | 3→3 | 0→0 | 0→0 | 120→120 | 2536.457991→2536.457991 | 2.199501→2.159047 | 2.460332→2.352505 |
| kitspace-solenoid-driver-j1 | 3→3 | 0→0 | 0→0 | 36→36 | 1058.071791→1058.071791 | 0.734426→0.717862 | 0.862272→0.735374 |
| kitspace-solenoid-driver-j3 | 3→3 | 0→0 | 0→0 | 36→36 | 1062.528801→1062.528801 | 0.734851→0.729763 | 0.739216→0.744513 |
| kitspace-solenoid-driver-j4 | 3→3 | 0→0 | 0→0 | 27→27 | 719.054226→719.054226 | 0.754200→0.717476 | 0.863730→1.247523 |
| nextbusclock-nextbusclockv1-j2-large | 3→3 | 0→0 | 0→0 | 123→123 | 4566.177941→4566.177941 | 3.201386→3.048396 | 3.331639→3.195963 |
| nextbusclock-nextbusclockv1-j2-medium | 3→3 | 0→0 | 0→0 | 3→3 | 4452.316236→4452.316236 | 0.993738→0.979264 | 1.008286→0.994649 |
| nextbusclock-nextbusclockv1-j2-small | 3→3 | 0→0 | 0→0 | 6→6 | 4494.817682→4494.817682 | 0.861875→0.717422 | 0.887960→0.750155 |
| nextbusclock-nextbusclockv1-j3 | 0→0 | 9→9 | 0→0 | 195→195 | 4286.173575→4286.173575 | 8.183021→7.819575 | 8.458098→8.132587 |
| paperino-hw-paperino-shield-j4 | 0→0 | 18→18 | 0→0 | 3→3 | 513.705377→513.705377 | 16.612570→16.455110 | 17.026949→17.871579 |
| photon-sprinkler-sprinkler-j1 | 0→0 | 6→6 | 0→0 | 36→36 | 1756.966036→1756.966036 | 11.908532→11.650184 | 13.164905→12.625845 |
| photon-sprinkler-sprinkler-j3 | 0→0 | 6→6 | 0→0 | 36→36 | 1767.228152→1767.228152 | 15.124599→14.214079 | 15.504393→14.785355 |
| qrpcard-qrpcard-j1 | 3→3 | 0→0 | 0→0 | 177→177 | 2484.702587→2484.702587 | 1.385162→1.411203 | 1.403169→1.543235 |
| qrpcard-qrpcard-j2-medium | 3→3 | 0→0 | 0→0 | 60→60 | 1418.743503→1418.743503 | 0.866654→0.859877 | 0.879301→0.881267 |
| qrpcard-qrpcard-j2-small | 0→0 | 0→0 | 6→6 | 51→51 | 1441.298853→1441.298853 | 0.733331→0.740150 | 0.748955→0.742830 |
| qrpcard-qrpcard-j4 | 0→0 | 0→0 | 3→3 | 114→114 | 1569.596735→1569.596735 | 1.000952→1.007483 | 1.017748→1.158577 |
| rufs-smart-psu-j1 | 3→3 | 0→0 | 0→0 | 81→81 | 1162.302785→1162.302785 | 0.732525→0.875859 | 0.875646→0.884872 |
| rufs-smart-psu-j3 | 0→0 | 3→3 | 0→0 | 78→78 | 1137.053506→1137.053506 | 1.938830→1.755700 | 1.940115→1.971729 |
| rufs-smart-psu-j4 | 0→0 | 3→3 | 0→0 | 48→48 | 966.020516→966.020516 | 1.245923→1.117862 | 1.538861→1.241307 |
| sv650sds-sds-tool-j4 | 3→3 | 0→0 | 0→0 | 42→42 | 672.225165→672.225165 | 0.853391→0.853161 | 0.863901→0.879528 |
