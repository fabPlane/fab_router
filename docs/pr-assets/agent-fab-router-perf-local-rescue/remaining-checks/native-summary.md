## Complete native comparison

Both runs use all 26 frozen cases × seeds 1/2/3, same host/cores 12–19, unchanged
input/settings/runtime/checker/order. The current normal-source sweep matches all
78 sessions and quality metrics from the prior cycle. The after sweep explicitly
selects the research adapter; all production defaults remain unchanged. Fifteen
sessions change across five cases, with the same closure gain on each seed. The
other 63 sessions match exactly. All attempts preserve native fidelity. New-error
details are compared by complete structured records, not just total counts; no
candidate error is introduced or substituted for an earlier finding.

| Metric, 78 attempts | Normal | Explicit research adapter |
| --- | ---: | ---: |
| Passed / cases valid 3-of-3 | 39/78 / 13/26 | 39/78 / 13/26 |
| Native opens | 120 | 99 |
| New native errors relative to frozen input | 27 | 27 |
| Attempt median / p95 seconds | 1.259 / 17.476 | 1.122 / 20.910 |
| Total route seconds | 421.212 | 436.166 |
| Total vias, summed across attempts | 2826 | 2826 |
| Total length mm, summed across attempts | 58809.321 | 60080.812 |

Opens improve 17.5%; no additional board passes. All 27 pre-existing thermal
errors remain unresolved: this suite is **not native DRC clean**. Recovery adds
copper at the full legal width, with no vias or changes to existing copper. Total
route time increases 3.55% and p95 increases; median variation on the shared host
is not a speed gain. Tests and other pinned work overlap the runs. The adapter
has no production setting and is not enabled by a downstream engine pin bump.

[Per-case median/p95, opens, errors, vias, length](remaining-checks/native-tables.md),
[all 78 paired measurements, per-target step logs and source/control identities](remaining-checks/native-comparison.json),
[normal-source historical control](remaining-checks/normal-native-verification.json).

Required final checks pass: typecheck; 65 files / zero layer violations; 873 tests,
zero failures, 398997 assertions in 276.31 seconds. A prior full check also passed
872 tests before adding the real adapter regression; its targeted run passes.
No executable TypeScript changes follow the final full check. Report scripts are
separately syntax-checked and the comparison executed successfully. The inspected
PNG regenerates byte-for-byte. Prior exploratory 3-repeat batches remain in cycle
scratch and have identical corresponding session hashes; no routing measurements
were discarded. Two candidate launch attempts encountered the benchmark's exclusive
lock before creating an output or running an attempt; the final sweep started only
after the normal process exited. No lock bypass or frozen runtime/checker edit.

Across all 78 native attempts the adapter logs 87 collected targets:
21 kept, 30 region/graph misses, 30 cooperative-budget stops and six unsupported
non-pad endpoint pairs. All budget stops charged 100000 work units. Every kept
connection records its successful region step; the raw log includes rejected
steps. These are engine collection counts, not a replacement for native opens.
The remaining work includes via transitions and pour/track attachment, plus full
route-budget/abort propagation and avoiding recovery setup on completed boards.
Full slow acceptance with recovery enabled is still required before production
integration; the current public pipeline remains unchanged.
