
## Larger input limits

Three repeats per mode/input, same input hashes, settings, host and cores 12–19.
Normal routing is limited to two passes / 120 seconds; optimisation and fanout
are disabled. These are engine-only bounded runs, not native DRC or full slow
acceptance. The candidate intentionally skips recovery after a normal timeout.

| Input | Normal incomplete each | Candidate incomplete each | Median / p95 s normal → candidate | Added exact violations each | Vias median normal → candidate | Length mm median normal → candidate | Normal / candidate timeouts |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Dense6 | [191, 191, 191] | [191, 191, 191] | 120.060 / 120.061 → 120.077 / 120.078 | 0 | 266 → 266 | 2027.648 → 2027.648 | 3 / 3 |
| L2 | [29, 29, 29] | [24, 24, 24] | 22.410 / 22.723 → 26.977 / 31.036 | 0 | 51 → 51 | 744.762 → 992.605 | 0 / 0 |
| L3 | [154, 154, 154] | [154, 154, 154] | 120.026 / 120.026 → 120.035 / 120.042 | 0 | 91 → 91 | 1624.333 → 1624.333 | 3 / 3 |

L2 closes five more links after its two normal passes. L3 and Dense6 reach the
normal deadline in every repeat, leaving 154 and 191 engine links respectively;
recovery is skipped on all six candidate timeout runs. There is no recovery,
completion or native-safety claim for those stress inputs. Thus this experiment
does not satisfy the large-input/slow-acceptance gate for production integration.
L2 sessions are deterministic within each mode and differ when recovery runs.
All six L3 sessions match exactly. Dense6 has distinct session hashes within
each mode despite the same incomplete/via counts and essentially identical
lengths (floating sums vary around 1e-12 mm). No byte/geometry invariance claim
is made for timed Dense6 runs; every observed session hash is retained.

[Complete bounded-run records](remaining-checks/large-measurements.json),
[grouped summary](remaining-checks/large-summary.json). No route attempts are
dropped; all 18 records are retained. The initial report export stopped at an
unsupported Dense6 session-determinism assertion; the report now records that
variation. No routing measurements were discarded. Normal routing and source implementation
remain unchanged, and no production or downstream pin change is adopted.
