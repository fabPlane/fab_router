Counts sum three seeds per case. `Never inserted` means a connection key never returned a successful insertion during observed calls; it is NOT a final residual-connectivity count. Counters cover calls inside routeConnection only. The pop-limit count excludes frontier exhaustion and timeout unless the pop limit was also exceeded. Instrumented timing is diagnostic overhead, not a speed comparison.

| Case | Opens (both) | Native errors (both) | Regions | Coarsened | Searches | Pop-limit exits | Never-inserted pop-limit exits | Before median/p95 s | Diagnostic median/p95 s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fan-controller-fan-controller-j1 | 15 | 0 | 1296 | 0 | 1296 | 291 | 9 | 4.203/4.299 | 4.099/5.811 |
| fan-controller-fan-controller-j2-large | 0 | 0 | 42 | 0 | 42 | 0 | 0 | 1.009/1.229 | 1.038/1.209 |
| fan-controller-fan-controller-j2-medium | 0 | 0 | 6 | 0 | 6 | 0 | 0 | 1.023/1.159 | 0.752/0.859 |
| fan-controller-fan-controller-j2-small | 3 | 0 | 240 | 0 | 240 | 120 | 120 | 3.979/4.533 | 3.509/4.001 |
| hellscribe-hellscribe-j1 | 9 | 0 | 777 | 0 | 777 | 204 | 0 | 2.967/3.126 | 2.293/2.344 |
| hellscribe-hellscribe-j2-large | 3 | 0 | 27 | 0 | 27 | 3 | 0 | 1.293/1.317 | 1.244/1.499 |
| kitspace-aquarius-j4 | 45 | 18 | 2220 | 0 | 2220 | 1656 | 1128 | 58.616/61.927 | 53.753/56.537 |
| kitspace-lcr-addon-j3 | 0 | 0 | 495 | 0 | 495 | 291 | 0 | 2.696/2.766 | 2.332/3.044 |
| kitspace-solenoid-driver-j1 | 0 | 0 | 69 | 0 | 69 | 15 | 0 | 1.028/1.140 | 0.859/1.000 |
| kitspace-solenoid-driver-j3 | 0 | 0 | 66 | 0 | 66 | 12 | 0 | 0.894/1.136 | 0.881/0.908 |
| kitspace-solenoid-driver-j4 | 0 | 0 | 45 | 0 | 45 | 9 | 0 | 0.922/1.025 | 0.867/0.989 |
| nextbusclock-nextbusclockv1-j2-large | 0 | 0 | 615 | 0 | 615 | 474 | 0 | 3.608/3.898 | 3.161/3.214 |
| nextbusclock-nextbusclockv1-j2-medium | 0 | 0 | 48 | 0 | 48 | 45 | 0 | 1.039/1.305 | 1.010/1.126 |
| nextbusclock-nextbusclockv1-j2-small | 0 | 0 | 12 | 0 | 12 | 3 | 0 | 0.888/1.041 | 0.745/0.754 |
| nextbusclock-nextbusclockv1-j3 | 9 | 0 | 2148 | 0 | 2148 | 1263 | 0 | 8.651/9.003 | 8.142/8.867 |
| paperino-hw-paperino-shield-j4 | 18 | 0 | 1281 | 0 | 1281 | 1119 | 1101 | 17.112/18.386 | 16.965/18.214 |
| photon-sprinkler-sprinkler-j1 | 6 | 0 | 1668 | 0 | 1668 | 1584 | 1476 | 13.262/13.703 | 13.383/13.588 |
| photon-sprinkler-sprinkler-j3 | 6 | 0 | 1980 | 0 | 1980 | 1890 | 1773 | 16.653/16.790 | 16.474/16.525 |
| qrpcard-qrpcard-j1 | 0 | 0 | 297 | 0 | 297 | 123 | 0 | 1.722/1.875 | 1.411/2.182 |
| qrpcard-qrpcard-j2-medium | 0 | 0 | 33 | 0 | 33 | 18 | 0 | 0.888/1.150 | 0.874/0.882 |
| qrpcard-qrpcard-j2-small | 0 | 6 | 3 | 0 | 3 | 0 | 0 | 0.922/1.045 | 0.739/0.744 |
| qrpcard-qrpcard-j4 | 0 | 3 | 111 | 0 | 111 | 18 | 0 | 1.144/1.438 | 1.151/1.298 |
| rufs-smart-psu-j1 | 0 | 0 | 60 | 0 | 60 | 0 | 0 | 0.869/0.890 | 0.901/0.912 |
| rufs-smart-psu-j3 | 3 | 0 | 996 | 0 | 996 | 60 | 54 | 2.214/2.394 | 1.953/1.967 |
| rufs-smart-psu-j4 | 3 | 0 | 216 | 0 | 216 | 30 | 30 | 1.280/1.530 | 1.261/1.268 |
| sv650sds-sds-tool-j4 | 0 | 0 | 51 | 0 | 51 | 6 | 0 | 1.153/1.177 | 0.883/1.011 |
