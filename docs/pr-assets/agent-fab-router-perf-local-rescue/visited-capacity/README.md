### Cycle 91: larger initial visited-state table rejected

Tested initial search-table capacity 4096 instead of 1024 in an isolated candidate. No production change adopted. This tests whether fewer early growth/rehash operations improve routing; it does not attribute timing to an individual allocation or hash operation.

Three alternating control/candidate pairs per case on the same machine, cores 12–19, sequential nice 10, 180-second process limits. Default 100 passes, optimizer enabled, local recovery unset. Direct routeDsn timings; p95 uses nearest rank (maximum of three).

| Case | Control median / p95 s | Candidate median / p95 s | Median change |
|---|---:|---:|---:|
| kitspace-aquarius-j4 | 40.893352 / 43.929997 | 42.034647 / 43.274382 | +2.79% |
| photon-sprinkler-sprinkler-j3 | 13.139998 / 13.352815 | 13.545244 / 14.503867 | +3.08% |
| paperino-hw-paperino-shield-j4 | 12.721974 / 13.285792 | 12.335658 / 12.714239 | -3.04% |

Total nine replay durations: 200.904163 → 204.152496 s (+1.62%). All 18 sessions byte-identical to retained default references; full settings/results/stats/diagnostics match after removing only report.wallClockMs. Engine incomplete counts remain 8/2/6 with zero represented-rule additions each. These are not native scores. No fresh native/full 26×3, dense, ladder or slow acceptance measurement: candidate rejected at focused speed gate. Existing native thermal failures remain unresolved; recovery remains default off.

Store differential: 1,583,264 checks across eight reset generations and 18,000 insertions each, including overwrites, growth, high key bits, missing keys, parent and score lookups. Candidate typecheck passes. Production typecheck, layer check and full tests pass (see retained checks log). No test, rule or checker weakened.

Reproduce from the repository root:
```sh
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/visited-capacity/reproduce.py /tmp/visited-capacity-replay
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/visited-capacity/verify.py
```
The first command reconstructs both complete source identities from the adjacent licensed source archive, applies the sole candidate change, checks store behavior, and reruns all 18 attempts. It requires Bun. Use a new destination directory. `--prepare-only` reconstructs and checks without routing. Raw reports, sessions, process logs and timings are retained; manifest hashes cover all members. Source/spec audit has 1,488 files per variant. The initial candidate typecheck lacked a dependency link (exit 127); after linking existing dependencies it passed. All routing attempts completed successfully.

![Focused visited-table timings](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/visited-capacity/timing.png?raw=true)
