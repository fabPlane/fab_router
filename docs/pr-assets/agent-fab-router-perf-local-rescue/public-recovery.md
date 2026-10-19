# Default-off public local recovery experiment

`route`, `routeDsn` and `routeSrj` now accept `localRecovery: true`. Omitting the
setting preserves normal routing. This is an experimental insertion-only
post-pass after optimisation. It adds no rip-up, rule relaxation, neck-down,
via placement or finer-grid legalisation. Those parts of the broader recovery
proposal remain unimplemented.

The post-pass snapshots up to 16 remaining connections, resolves each net's own
profile and tries endpoint boxes grown by 0, 4, 8 and 16 pitches. Pad, foreign
track-segment and barrel bounding-box corners propose a visibility graph, capped
at 512 nodes per common permitted sheet. Exact full-width edge shaping decides
which edges are usable. Each target shares 100,000 charged search-work units
and a 15-second cooperative budget across its four boxes. Non-pad endpoints
remain unsupported and stay open.

The existing route journal and spatial index receive accepted copper; using a
second index would leave final pipeline connectivity and per-net counts stale.
Each accepted target inserts exactly one Track. Remaining item capacity limits
the target count, so recovery cannot exceed `maxItems`. Final report counts are
measured from actual layout changes; completed and attempted counts include
recovery. Existing `onConnection`, `onProgress` and `onLog` hooks report recovery,
with per-target trial outcomes and the step that closed a connection in the log.
Ignored nets remain obstacles. Disabled routing skips the post-pass.

The route-wide recovery deadline starts on entry to the pipeline, before its
initial DRC and normal passes, using a monotonic clock. Recovery observes the
same AbortSignal and remaining time budget. Aborted or timed-out normal routes
skip recovery. Stops during recovery retain earlier accepted targets and rewind
the current proposal, including after exact validation. Synchronous geometry,
connectivity and index operations are cooperative and cannot be preempted;
this is not a hard latency guarantee. Recovery's 15-second per-target cap is
separate from the normal pass connection budget.

Every retained proposal must fit its whole copper within the local box, pass
exact geometry DRC, preserve retained copper and previously connected terminals,
and close its target. Dirty exact baselines skip recovery. Native thermal-zone
findings are outside this represented-rule check; native checker measurements
remain necessary. Existing native errors are not repaired by this experiment.

Reproduce the unit/type/layer checks from the router worktree:

```bash
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

From the benchmark checkout, using unused result directories:

```bash
taskset -c 12-19 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-perf --out /tmp/unused-normal-public
taskset -c 12-19 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-perf/docs/pr-assets/agent-fab-router-perf-local-rescue/public-setting --out /tmp/unused-enabled-public
```

The second entry point only calls the actual public API with the setting enabled.
It contains no routing implementation and does not use the earlier research
adapter. Frozen inputs, per-job settings, scoring and native checker remain intact.

From the router worktree (engine-only larger inputs and paired slow acceptance):

```bash
taskset -c 12-19 nice -n 10 timeout 7200 bun run docs/pr-assets/agent-fab-router-perf-local-rescue/run-public-large.ts /tmp/unused-large.json /home/hyper/bench/boards/ladder/l2.dsn /home/hyper/bench/boards/ladder/l3-cycle18.dsn /home/hyper/bench/boards/dense/dense6-bga324.dsn
taskset -c 12-19 nice -n 10 timeout 7200 bun run docs/pr-assets/agent-fab-router-perf-local-rescue/run-public-slow.ts /tmp/unused-slow.json
taskset -c 12-19 nice -n 10 timeout 7200 python3 docs/pr-assets/agent-fab-router-perf-local-rescue/public-dense-native.py /home/hyper/bench/wt/fp-perf/benchmarks/autorouter /home/hyper/bench/wt/fr-perf /home/hyper/bench/wt/fr-perf /home/hyper/bench/boards/dense/fab_pcb-case-dense6-bga324-j1 /tmp/unused-dense-native
```
