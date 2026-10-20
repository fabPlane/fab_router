### Cycle 93: heap insertion movement rejected

Tested moving parent heap entries down a hole during frontier insertion, then writing the inserted entry once, instead of swapping at each level. Candidate code is isolated; production code, settings and rules are unchanged. For finite search priorities this preserves `(f,h,seq)` ordering. This experiment does not establish equivalence for nonfinite priorities. The retained earlier profiles attribute only 70–201 ms of self samples per case to insertion, so this is a limited opportunity; no causal timing attribution is claimed.

Three alternating control/candidate pairs per case on the same host, cores 12–19, sequential nice 10, 180-second process limits. Default 100 passes, optimizer enabled, local recovery unset. Direct routeDsn timings; p95 is nearest rank (maximum of three).

| Case | Control median / p95 s | Candidate median / p95 s | Median change |
|---|---:|---:|---:|
| kitspace-aquarius-j4 | 44.707980 / 45.214567 | 43.063105 / 43.126766 | -3.68% |
| photon-sprinkler-sprinkler-j3 | 13.590287 / 13.773742 | 13.769893 / 14.635003 | +1.32% |
| paperino-hw-paperino-shield-j4 | 11.090098 / 11.798582 | 10.826132 / 11.458654 | -2.38% |

Total nine replay durations: 204.875520 → 200.790532 s (-1.99%). REJECTED: sprinkler median +1.32% and p95 +6.25% outweigh a favorable aggregate for adoption purposes. All 18 sessions byte-identical to retained default references; full settings/results/stats/diagnostics match removing only report.wallClockMs. Engine incomplete counts remain 8/2/6 with zero represented-rule additions each. These are not native scores. No fresh native/full 26×3, dense, ladder or slow acceptance measurement: rejection at the focused gate. Existing native thermal failures remain unresolved; recovery remains default off.

Heap differential: 1,392,016 checks, eight generations with 18,000 pushes each; tie-heavy priorities, high state values, growth, interleaved push/pop, draining, clearing a nonempty heap, and an independent sorted oracle. Candidate typecheck passed; this one-second static check overlapped a routing process. Required production typecheck, layer check and full tests pass as recorded in checks.log. No tests, checker or rules weakened. No routing attempt failed or was omitted.

Reproduce from the repository root:
```sh
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/heap-push/reproduce.py /tmp/heap-push-replay
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/heap-push/verify.py
```
The first command reconstructs both source variants from the adjacent licensed source archive, applies the sole candidate change, checks heap behavior, and reruns all 18 attempts. Requires Bun, Python and a new destination directory. `--prepare-only` reconstructs and checks without routing. All 1,488 source/spec hashes per variant match independent reconstruction. Raw sessions, complete reports, timing and process logs are retained, with a hash manifest. Verifier tests reject session/report/source/missing-run corruption even with recomputed hashes.

![Focused heap insertion timings](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/heap-push/timing.png?raw=true)
