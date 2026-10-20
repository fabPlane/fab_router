# Disposable pour attachment experiment

Recovery-only synthetic trials, three repeats per cell. Values are incomplete connections per trial; zero exact violations in every trial. No native score is inferred.

| Fixture | Current | Vertex average | First vertex |
| --- | ---: | ---: | ---: |
| solid | 1 | 0 | 0 |
| hole | 1 | 1 | 0 |
| concave | 1 | 1 | 0 |
| keepout | 1 | 0 | 1 |

Fresh full frozen suite on the same host and cores 12–19: 26 cases × 3 repeats per source; both use public recovery enabled. Known native errors remain unresolved. Timing is observed on a shared host with concurrent unit tests.

| Metric | Current recovery | Disposable first vertex |
| --- | ---: | ---: |
| passed | 39 | 39 |
| opens | 99 | 99 |
| new_errors | 27 | 27 |
| median_s | 1.262377 | 1.266136 |
| p95_s | 17.876883 | 18.651932 |
| total_s | 443.206414 | 458.469220 |
| vias | 2826 | 2826 |
| length_mm | 60080.812022 | 60080.812022 |

Identical sessions: 78/78. Regression records: 0.

| Case | Current median / p95 s | Probe median / p95 s | Opens current / probe (3 runs) |
| --- | ---: | ---: | ---: |
| fan-controller-fan-controller-j1 | 5.095172 / 5.273085 | 5.824582 / 6.068520 | 12 / 12 |
| fan-controller-fan-controller-j2-large | 0.860635 / 0.873623 | 0.895693 / 0.920161 | 0 / 0 |
| fan-controller-fan-controller-j2-medium | 0.736042 / 0.741417 | 0.778741 / 0.787263 | 0 / 0 |
| fan-controller-fan-controller-j2-small | 4.423368 / 5.074631 | 4.878661 / 4.882346 | 3 / 3 |
| hellscribe-hellscribe-j1 | 4.127002 / 4.235607 | 4.021817 / 4.999848 | 9 / 9 |
| hellscribe-hellscribe-j2-large | 1.004370 / 1.012208 | 1.050141 / 1.197341 | 3 / 3 |
| kitspace-aquarius-j4 | 56.912658 / 59.692595 | 59.152004 / 59.877375 | 45 / 45 |
| kitspace-lcr-addon-j3 | 2.291647 / 2.323377 | 2.223092 / 2.260758 | 0 / 0 |
| kitspace-solenoid-driver-j1 | 0.735271 / 0.738233 | 0.742614 / 0.888610 | 0 / 0 |
| kitspace-solenoid-driver-j3 | 0.749534 / 0.763254 | 0.760819 / 0.878367 | 0 / 0 |
| kitspace-solenoid-driver-j4 | 0.866838 / 0.871505 | 0.772840 / 0.874857 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-large | 3.208385 / 3.365925 | 3.430226 / 3.453640 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-medium | 1.000028 / 1.056177 | 1.179795 / 1.276428 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-small | 0.739022 / 0.877927 | 0.733271 / 0.896941 | 0 / 0 |
| nextbusclock-nextbusclockv1-j3 | 9.250383 / 9.839387 | 9.339042 / 9.360497 | 3 / 3 |
| paperino-hw-paperino-shield-j4 | 16.705417 / 17.876883 | 17.469977 / 18.651932 | 12 / 12 |
| photon-sprinkler-sprinkler-j1 | 13.269054 / 13.372878 | 12.541198 / 13.995080 | 3 / 3 |
| photon-sprinkler-sprinkler-j3 | 15.444038 / 15.989017 | 17.516815 / 17.587991 | 3 / 3 |
| qrpcard-qrpcard-j1 | 1.385565 / 1.535177 | 1.433733 / 1.539781 | 0 / 0 |
| qrpcard-qrpcard-j2-medium | 0.864342 / 0.893105 | 0.880122 / 0.906794 | 0 / 0 |
| qrpcard-qrpcard-j2-small | 0.733425 / 0.745147 | 0.766326 / 0.884280 | 0 / 0 |
| qrpcard-qrpcard-j4 | 1.130391 / 1.301225 | 1.019423 / 1.255844 | 0 / 0 |
| rufs-smart-psu-j1 | 0.879808 / 0.898128 | 0.753156 / 0.875345 | 0 / 0 |
| rufs-smart-psu-j3 | 2.212927 / 2.359408 | 2.053505 / 2.235961 | 3 / 3 |
| rufs-smart-psu-j4 | 1.267864 / 1.268633 | 1.399642 / 1.410151 | 3 / 3 |
| sv650sds-sds-tool-j4 | 0.861682 / 0.878287 | 0.889749 / 0.892029 | 0 / 0 |

Larger supplied DSNs: one exploratory pair/input, not a repeated timing study or native DRC score.

| Input | Incomplete current / probe | Seconds current / probe | Vias current / probe | Length mm current / probe | Pours current / probe | Same session |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| dense6-bga324.dsn | 190 / 190 | 185.453326 / 181.172326 | 266 / 266 | 2032.379268 / 2032.379268 | 0 / 0 | True |
| l2-cycle18.dsn | 21 / 21 | 23.383931 / 23.17238 | 51 / 51 | 1094.342601 / 1094.342601 | 0 / 0 | True |
| l3-cycle18.dsn | 153 / 153 | 195.187344 / 197.139156 | 93 / 93 | 1688.604896 / 1688.604896 | 0 / 0 | True |

Prepared Dense6 native case: three repeats/source, separate from supplied DSN.

| Metric | Current | Probe |
| --- | --- | --- |
| passed | 0 | 0 |
| opens | [181, 181, 181] | [181, 181, 181] |
| new_errors | [0, 0, 0] | [0, 0, 0] |
| median_s | 186.008879585 | 178.591665957 |
| p95_s | 191.457269276 | 199.460547174 |
| vias | [315, 315, 315] | [315, 315, 315] |
| length_mm | [2317.561458085628, 2317.561458085628, 2317.561458085628] | [2317.561458085628, 2317.561458085628, 2317.561458085628] |
| engine_incomplete | [181, 181, 181] | [181, 181, 181] |
| timeouts | [False, False, False] | [False, False, False] |

Dense native regression records: 0.
