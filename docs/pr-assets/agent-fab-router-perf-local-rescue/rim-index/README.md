# Prepared rim edge index experiment

Rejected focused candidate; production sources unchanged. Snapshot rings at lattice rim insertion, index closed-y edge spans in at most 128 bins, retain original edge order and exact predicates. Removal invalidates; reinsertion rebuilds; a foreign/unindexed rim uses the existing implementation. Snapshot mutation ownership follows the existing lattice contract. No rule, settings, recovery default or checker changes.

Same host, cores 12–19, nice 10, sequential alternating pairs, three repeats each; shared host load uncontrolled. p95 is the maximum of three samples. Engine replay timings exclude native checking and conversion. All 18 sessions byte-identical to retained references; all complete engine reports match except wallClockMs. Incomplete counts 8/2/6 and represented violations added 0 each are NOT native scores. Existing native thermal failures remain unresolved. No full 26×3, dense, ladder or slow-acceptance run: focused timing rejection. No speed improvement adopted.

| Case | Control median / p95 (s) | Candidate median / p95 (s) |
|---|---:|---:|
| kitspace-aquarius-j4 | 34.694 / 35.453 | 28.043 / 28.211 |
| paperino-hw-paperino-shield-j4 | 10.111 / 10.313 | 8.808 / 9.084 |
| photon-sprinkler-sprinkler-j3 | 11.335 / 11.771 | 11.657 / 12.494 |

219,588 finite-coordinate differential classifications pass (radial rings, reversed winding, vertices, midpoints, random probes), plus immutable snapshot and lattice lifecycle probes. This is not exhaustive proof for arbitrary/nonfinite geometry.

Reproduce from repository root:

```bash
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/rim-index/reproduce.py /tmp/rim-index-replay
```

The adjacent default-slow-profile package supplies the licensed exact source archive, inputs and replay implementation. Complete source/spec hashes are recorded for both variants. All 18 raw sessions, reports, timings and process logs are retained in attempts.tar.xz. verify.py validates the retained runs, including complete report/session equivalence and timing identity.

Final unchanged production checks: typecheck PASS; layer checks PASS (71 files, zero violations); 914 tests PASS, zero failures, 649747 assertions, 338.92 seconds. Candidate typecheck PASS; candidate full suite not run after focused rejection. No test/checker/rule weakening.
