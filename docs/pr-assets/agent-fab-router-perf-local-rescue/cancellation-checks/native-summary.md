# Fresh complete native comparison

Same 26 cases × seeds 1/2/3; same host, cores 12–19, frozen input/settings/runtime/checker/order. Normal production source unchanged. Before is normal routing; after explicitly selects the research adapter with shared deadline/cancellation. Timing overlaps tests/slow acceptance on a shared host; no speed claim.

| Metric, all 78 attempts | Normal | Research adapter |
| --- | ---: | ---: |
| Passed / valid cases 3-of-3 | 39 / 13 | 39 / 13 |
| Native opens | 120 | 99 |
| New native errors relative to frozen input | 27 | 27 |
| Attempt median / p95 seconds | 1.136190 / 17.026949 | 1.118558 / 19.271779 |
| Total route seconds | 403.581081 | 438.932460 |
| Vias summed across attempts | 2826.000 | 2826.000 |
| Length mm summed across attempts | 58809.321 | 60080.812 |

Zero quality/fidelity regressions or introduced/substituted structured error records. 63/78 sessions identical between normal and candidate. All 78 candidate sessions and quality metrics also match the prior research adapter. The existing 27 thermal errors remain unresolved. No additional board passes; no claim of native DRC clean results. Added length reflects inserted missing links, without a completed-route comparator.

Slow public-API acceptance: INCOMPLETE: 1200-second external timeout; see complete retained console log. No full-suite result. Production routing remains unchanged; this run does not exercise recovery. The failing cases are retained, not accepted or weakened.

## Per-case detail

p95 of three repeats is their maximum. Case aliases map to frozen input ids in the raw JSON.

| Case | Median / p95 s normal → candidate | Passed /3 | Opens | Native errors | Vias median | Length mm median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C01 | 3.960 / 4.039 → 5.010 / 5.534 | 0 → 0 | 15 → 12 | 0 → 0 | 102 → 102 | 909.022 → 961.004 |
| C02 | 0.992 / 1.009 → 0.859 / 0.894 | 3 → 3 | 0 → 0 | 0 → 0 | 26 → 26 | 561.860 → 561.860 |
| C03 | 0.732 / 0.742 → 0.873 / 0.882 | 3 → 3 | 0 → 0 | 0 → 0 | 27 → 27 | 531.997 → 531.997 |
| C04 | 3.491 / 3.772 → 4.191 / 4.417 | 0 → 0 | 3 → 3 | 0 → 0 | 22 → 22 | 495.567 → 495.567 |
| C05 | 2.159 / 2.164 → 3.799 / 4.061 | 0 → 0 | 9 → 9 | 0 → 0 | 100 → 100 | 1315.786 → 1315.786 |
| C06 | 1.014 / 1.033 → 0.985 / 0.994 | 0 → 0 | 3 → 3 | 0 → 0 | 111 → 111 | 1369.282 → 1369.282 |
| C07 | 50.769 / 53.973 → 58.869 / 59.042 | 0 → 0 | 45 → 45 | 18 → 18 | 130 → 130 | 1731.113 → 1731.113 |
| C08 | 2.200 / 2.460 → 2.180 / 2.440 | 3 → 3 | 0 → 0 | 0 → 0 | 40 → 40 | 845.486 → 845.486 |
| C09 | 0.734 / 0.862 → 0.731 / 0.925 | 3 → 3 | 0 → 0 | 0 → 0 | 12 → 12 | 352.691 → 352.691 |
| C10 | 0.735 / 0.739 → 0.732 / 0.757 | 3 → 3 | 0 → 0 | 0 → 0 | 12 → 12 | 354.176 → 354.176 |
| C11 | 0.754 / 0.864 → 0.771 / 0.864 | 3 → 3 | 0 → 0 | 0 → 0 | 9 → 9 | 239.685 → 239.685 |
| C12 | 3.201 / 3.332 → 3.024 / 3.820 | 3 → 3 | 0 → 0 | 0 → 0 | 41 → 41 | 1522.059 → 1522.059 |
| C13 | 0.994 / 1.008 → 0.976 / 0.984 | 3 → 3 | 0 → 0 | 0 → 0 | 1 → 1 | 1484.105 → 1484.105 |
| C14 | 0.862 / 0.888 → 0.715 / 0.759 | 3 → 3 | 0 → 0 | 0 → 0 | 2 → 2 | 1498.273 → 1498.273 |
| C15 | 8.183 / 8.458 → 9.097 / 9.567 | 0 → 0 | 9 → 3 | 0 → 0 | 65 → 65 | 1428.725 → 1561.816 |
| C16 | 16.613 / 17.027 → 18.120 / 19.272 | 0 → 0 | 18 → 12 | 0 → 0 | 1 → 1 | 171.235 → 281.792 |
| C17 | 11.909 / 13.165 → 12.144 / 12.303 | 0 → 0 | 6 → 3 | 0 → 0 | 12 → 12 | 585.655 → 649.578 |
| C18 | 15.125 / 15.504 → 14.808 / 17.000 | 0 → 0 | 6 → 3 | 0 → 0 | 12 → 12 | 589.076 → 653.353 |
| C19 | 1.385 / 1.403 → 1.381 / 1.600 | 3 → 3 | 0 → 0 | 0 → 0 | 59 → 59 | 828.234 → 828.234 |
| C20 | 0.867 / 0.879 → 0.849 / 0.930 | 3 → 3 | 0 → 0 | 0 → 0 | 20 → 20 | 472.915 → 472.915 |
| C21 | 0.733 / 0.749 → 0.716 / 0.738 | 0 → 0 | 0 → 0 | 6 → 6 | 17 → 17 | 480.433 → 480.433 |
| C22 | 1.001 / 1.018 → 0.994 / 1.133 | 0 → 0 | 0 → 0 | 3 → 3 | 38 → 38 | 523.199 → 523.199 |
| C23 | 0.733 / 0.876 → 0.870 / 0.905 | 3 → 3 | 0 → 0 | 0 → 0 | 27 → 27 | 387.434 → 387.434 |
| C24 | 1.939 / 1.940 → 1.901 / 2.009 | 0 → 0 | 3 → 3 | 0 → 0 | 26 → 26 | 379.018 → 379.018 |
| C25 | 1.246 / 1.539 → 1.134 / 1.365 | 0 → 0 | 3 → 3 | 0 → 0 | 16 → 16 | 322.007 → 322.007 |
| C26 | 0.853 / 0.864 → 0.895 / 1.024 | 3 → 3 | 0 → 0 | 0 → 0 | 14 → 14 | 224.075 → 224.075 |
