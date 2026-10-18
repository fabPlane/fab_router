initial_native
| Case | Before median / p95 s | After median / p95 s | Speedup | Passed (both) | Opens / errors (both) |
|---|---:|---:|---:|---:|---:|
| fan-controller-fan-controller-j1 | 3.690 / 3.960 | 5.157 / 5.233 | 0.72× | 0/3 | 15 / 0 |
| fan-controller-fan-controller-j2-large | 0.852 / 0.869 | 1.173 / 1.310 | 0.73× | 3/3 | 0 / 0 |
| fan-controller-fan-controller-j2-medium | 0.889 / 0.901 | 0.959 / 1.271 | 0.93× | 3/3 | 0 / 0 |
| fan-controller-fan-controller-j2-small | 3.473 / 3.881 | 4.048 / 4.547 | 0.86× | 0/3 | 3 / 0 |
| hellscribe-hellscribe-j1 | 2.338 / 2.364 | 2.327 / 2.364 | 1.00× | 0/3 | 9 / 0 |
| hellscribe-hellscribe-j2-large | 0.959 / 1.294 | 1.328 / 1.667 | 0.72× | 0/3 | 3 / 0 |
| kitspace-aquarius-j4 | 53.917 / 55.157 | 60.314 / 62.390 | 0.89× | 0/3 | 45 / 18 |
| kitspace-lcr-addon-j3 | 2.361 / 2.800 | 2.203 / 2.389 | 1.07× | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j1 | 0.743 / 0.759 | 0.769 / 1.069 | 0.97× | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j3 | 0.742 / 0.745 | 0.891 / 0.907 | 0.83× | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j4 | 0.878 / 0.888 | 0.885 / 1.220 | 0.99× | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-large | 3.339 / 3.540 | 3.323 / 3.642 | 1.00× | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-medium | 1.007 / 1.025 | 1.069 / 1.391 | 0.94× | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-small | 0.877 / 0.898 | 0.899 / 0.968 | 0.98× | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j3 | 9.830 / 9.953 | 8.941 / 9.054 | 1.10× | 0/3 | 9 / 0 |
| paperino-hw-paperino-shield-j4 | 16.857 / 21.991 | 22.723 / 22.921 | 0.74× | 0/3 | 18 / 0 |
| photon-sprinkler-sprinkler-j1 | 14.379 / 15.008 | 12.892 / 13.608 | 1.12× | 0/3 | 6 / 0 |
| photon-sprinkler-sprinkler-j3 | 16.470 / 17.950 | 15.591 / 16.796 | 1.06× | 0/3 | 6 / 0 |
| qrpcard-qrpcard-j1 | 1.430 / 1.472 | 1.590 / 1.786 | 0.90× | 3/3 | 0 / 0 |
| qrpcard-qrpcard-j2-medium | 0.891 / 0.963 | 1.031 / 1.089 | 0.86× | 3/3 | 0 / 0 |
| qrpcard-qrpcard-j2-small | 0.737 / 0.805 | 0.765 / 0.949 | 0.96× | 0/3 | 0 / 6 |
| qrpcard-qrpcard-j4 | 0.987 / 1.288 | 1.342 / 1.389 | 0.73× | 0/3 | 0 / 3 |
| rufs-smart-psu-j1 | 0.724 / 0.733 | 1.033 / 1.083 | 0.70× | 3/3 | 0 / 0 |
| rufs-smart-psu-j3 | 2.094 / 2.275 | 2.083 / 2.176 | 1.01× | 0/3 | 3 / 0 |
| rufs-smart-psu-j4 | 1.324 / 1.413 | 1.303 / 1.500 | 1.02× | 0/3 | 3 / 0 |
| sv650sds-sds-tool-j4 | 0.885 / 1.051 | 1.043 / 1.128 | 0.85× | 3/3 | 0 / 0 |
Sum case medians: 142.673 → 155.682 seconds (0.916×)
Total time: 422.733 → 466.534 seconds
interleaved_native
| Case | Before median / p95 s | After median / p95 s | Speedup | Passed (both) | Opens / errors (both) |
|---|---:|---:|---:|---:|---:|
| fan-controller-fan-controller-j1 | 4.212 / 4.540 | 4.070 / 4.564 | 1.03× | 0/3 | 15 / 0 |
| fan-controller-fan-controller-j2-large | 0.896 / 0.917 | 0.888 / 1.055 | 1.01× | 3/3 | 0 / 0 |
| fan-controller-fan-controller-j2-medium | 0.764 / 0.881 | 0.768 / 0.888 | 0.99× | 3/3 | 0 / 0 |
| fan-controller-fan-controller-j2-small | 3.791 / 3.896 | 3.673 / 3.863 | 1.03× | 0/3 | 3 / 0 |
| hellscribe-hellscribe-j1 | 2.634 / 2.705 | 2.433 / 2.699 | 1.08× | 0/3 | 9 / 0 |
| hellscribe-hellscribe-j2-large | 0.999 / 1.205 | 1.130 / 1.179 | 0.88× | 0/3 | 3 / 0 |
| kitspace-aquarius-j4 | 51.877 / 52.110 | 44.559 / 45.946 | 1.16× | 0/3 | 45 / 18 |
| kitspace-lcr-addon-j3 | 2.173 / 2.293 | 2.133 / 2.145 | 1.02× | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j1 | 0.743 / 0.767 | 0.731 / 0.731 | 1.02× | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j3 | 0.748 / 0.759 | 0.740 / 0.865 | 1.01× | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j4 | 0.875 / 0.883 | 0.879 / 0.886 | 0.99× | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-large | 3.347 / 3.350 | 3.082 / 3.121 | 1.09× | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-medium | 1.017 / 1.033 | 1.029 / 1.049 | 0.99× | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-small | 0.763 / 0.769 | 0.777 / 0.906 | 0.98× | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j3 | 8.965 / 9.012 | 8.395 / 8.429 | 1.07× | 0/3 | 9 / 0 |
| paperino-hw-paperino-shield-j4 | 18.321 / 18.612 | 18.831 / 20.707 | 0.97× | 0/3 | 18 / 0 |
| photon-sprinkler-sprinkler-j1 | 13.389 / 13.895 | 12.933 / 15.237 | 1.04× | 0/3 | 6 / 0 |
| photon-sprinkler-sprinkler-j3 | 17.506 / 19.827 | 15.321 / 15.811 | 1.14× | 0/3 | 6 / 0 |
| qrpcard-qrpcard-j1 | 1.563 / 1.858 | 1.398 / 1.537 | 1.12× | 3/3 | 0 / 0 |
| qrpcard-qrpcard-j2-medium | 0.875 / 1.019 | 0.892 / 0.906 | 0.98× | 3/3 | 0 / 0 |
| qrpcard-qrpcard-j2-small | 0.770 / 0.883 | 0.745 / 0.753 | 1.03× | 0/3 | 0 / 6 |
| qrpcard-qrpcard-j4 | 1.180 / 1.317 | 1.309 / 1.326 | 0.90× | 0/3 | 0 / 3 |
| rufs-smart-psu-j1 | 0.871 / 0.887 | 0.784 / 0.896 | 1.11× | 3/3 | 0 / 0 |
| rufs-smart-psu-j3 | 1.889 / 1.908 | 1.897 / 1.915 | 1.00× | 0/3 | 3 / 0 |
| rufs-smart-psu-j4 | 1.299 / 1.424 | 1.296 / 1.444 | 1.00× | 0/3 | 3 / 0 |
| sv650sds-sds-tool-j4 | 0.868 / 0.891 | 1.007 / 1.043 | 0.86× | 3/3 | 0 / 0 |
Sum case medians: 142.335 → 131.700 seconds (1.081×)
Total time: 427.201 → 397.386 seconds
