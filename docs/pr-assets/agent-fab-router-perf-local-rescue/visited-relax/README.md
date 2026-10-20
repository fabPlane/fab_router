# Combined visited-state relaxation experiment

The isolated candidate combines the adjacent A* score comparison and parent/score write into a single table probe. Horizontal moves in both searches and layered via moves use the combined operation. The existing key hash, collision traversal, 70% growth threshold, generation reset, score comparison and queue order remain unchanged. Start-state insertion still uses the original unconditional operation. No rule, setting, checker or recovery default changes.

The candidate is measured against the retained exact source archive in the adjacent default-slow-profile package, using its three slow-case inputs and settings. This is an engine replay, excluding conversion and native checking. Same host, cores 12–19, nice 10, sequential alternating pairs, three repeats per case. p95 is the maximum of three observations. Shared host workloads are uncontrolled.

Reproduce from repository root:

```bash
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/visited-relax/reproduce.py /tmp/visited-relax-replay
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/visited-relax/verify.py
```

Use `--prepare-only` to reconstruct both source variants, check every recorded source/spec hash and run the actual-store differential probe without routing. The probe extracts the store classes from the reconstructed sources. It exercises insertions, improving/worsening/tied overwrites, growth, reset generations, missing states, high keys, infinities and NaN scores. These checks cover the operations exercised; they are not a proof for arbitrary inputs.

The source audit covers 1,488 archived source/spec files. The root also contains six ignored historical acceptance output CSVs, excluded from this source comparison. An initial whole-directory equality check detected those extra output files; checking all archived source members passes. No measured source changed during the runs.


Rejected at the focused timing gate: no production engine change is adopted. All 18 sessions must match the retained references byte for byte, and complete settings/results/reports must match after removing only report.wallClockMs. Engine incomplete counts are 8/2/6 for Aquarius/sprinkler/shield, with zero represented violations added. These are not native scores. Known native thermal failures remain unresolved. No full native 26×3, dense6, ladder or whole slow-acceptance rerun follows this rejection, and no DRC/completion gain is claimed.

| Case | Control median / p95 (s) | Candidate median / p95 (s) |
|---|---:|---:|
| kitspace-aquarius-j4 | 38.762649 / 38.950938 | 38.890463 / 39.685001 |
| paperino-hw-paperino-shield-j4 | 12.007843 / 12.325845 | 11.852389 / 12.331444 |
| photon-sprinkler-sprinkler-j3 | 12.591544 / 12.773583 | 12.694468 / 13.124164 |

Sum of nine engine durations: control 188.499236s; candidate 190.098881s. This excludes process startup and native checking.

The probe passes 1,344,000 differential comparisons. Initial candidate unit-test invocation found no tests because the retained archive contains source/spec but no test directory. The two unchanged root test files were then copied into the isolated candidate for a separate targeted run.

Packaging initially wrote this cycle data to the prior package directory; all prior tracked artifacts were restored exactly, the destination was corrected, and the cycle package regenerated. No timed attempt was changed, repeated or omitted.

Final unchanged production checks: typecheck PASS; layers PASS (71 files, zero violations); 914 tests PASS, zero failures, 649747 assertions, 322.19 seconds. No checker, rule or test expectation changed.

The isolated candidate passes typecheck and the two unchanged targeted test files: 19 tests, 74 assertions, zero failures, 7.40 seconds. Full candidate suite was not run after timing rejection. The final targeted test files have the same bytes as the root tracked test files; their hashes are recorded below.
