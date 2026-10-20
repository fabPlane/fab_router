# Complex-rim edge index experiment

Rejected focused candidate; production sources unchanged. Prepare only rims with at least 64 total edges at lattice rim insertion; small rims bypass the prepared dispatcher. Snapshot rings, index closed-y edge spans in at most 128 bins, retain original edge order and exact predicates. Removal invalidates; reinsertion rebuilds; a foreign/unindexed rim uses the existing implementation. Snapshot mutation ownership follows the existing lattice contract. No rule, settings, recovery default or checker changes.

Same host, cores 12–19, nice 10, sequential alternating pairs, three repeats each; shared host load uncontrolled. p95 is the maximum of three samples. Engine replay timings exclude native checking and conversion. All 18 sessions byte-identical to retained references; all complete engine reports match except wallClockMs. Incomplete counts 8/2/6 and represented violations added 0 each are NOT native scores. Existing native thermal failures remain unresolved. No full 26×3, dense, ladder or slow-acceptance run: focused timing rejection. No speed improvement adopted: sprinkler regressed at the focused gate.

| Case | Control median / p95 (s) | Candidate median / p95 (s) |
|---|---:|---:|
| kitspace-aquarius-j4 | 43.327 / 45.045 | 35.383 / 37.998 |
| paperino-hw-paperino-shield-j4 | 12.304 / 12.855 | 12.948 / 14.912 |
| photon-sprinkler-sprinkler-j3 | 13.810 / 14.000 | 14.224 / 14.369 |

219,588 finite-coordinate differential classifications and 12,321 large-rim shape probes pass (radial rings, reversed winding, vertices, midpoints, random probes), plus immutable snapshot and lattice lifecycle probes. This is not exhaustive proof for arbitrary/nonfinite geometry.

Reproduce from repository root:

```bash
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/rim-hybrid/reproduce.py /tmp/rim-hybrid-replay
```

The adjacent default-slow-profile package supplies the licensed exact source archive, inputs and replay implementation. Complete source/spec hashes are recorded for both variants. All 18 raw sessions, reports, timings and process logs are retained in attempts.tar.xz. verify.py validates the retained runs, including complete report/session equivalence and timing identity.

The threshold is 64 total outline/cutout vertices: the selected inputs have 92, 4 and 52 vertices respectively. Only the 92-vertex rim uses prepared bins. The optional dispatch is exposed through a getter backed by one stable function, avoiding per-query closure allocation. The smaller cases still check this optional dispatch before using their original geometry path. Their adverse timings do not identify the getter or any other individual operation as the cause; other host workloads are uncontrolled.

Initial candidate typecheck caught an exactOptionalPropertyTypes declaration mismatch: the getter can return undefined. The interface was corrected to explicitly permit undefined, with no emitted JavaScript change, during the first pair. Final typecheck passes. No timed routing attempt was stopped or omitted. The source audit records the final declaration; runtime code is identical across all candidate attempts.

No full native 26×3, dense6, ladder or whole slow-acceptance rerun follows the focused rejection. This package reports no native DRC result or completion gain. Existing native thermal failures remain unresolved. The immutable source archive is a retained control, not current main.

Sum of the nine route durations per variant: control 209.854346 s, candidate 188.284364 s. This favorable aggregate does not override the smaller-case regressions. It excludes process setup/checking and is not benchmark wall time.

Packaging initially targeted the prior cycle directory; its tracked files were restored exactly before staging and this package was relocated to its own directory. A first reconstruction attempt used an already-created output directory and failed before checking; the fresh-directory reconstruction in reconstruction.log passes. Neither packaging issue reran, omitted or modified any timed attempt.

Final unchanged production checks: typecheck PASS; layers PASS (71 files, zero violations); 914 tests PASS, zero failures, 649747 assertions, 330.67 seconds. Candidate typecheck PASS; full candidate suite not run after focused rejection. No checker, rules or test expectations changed.
