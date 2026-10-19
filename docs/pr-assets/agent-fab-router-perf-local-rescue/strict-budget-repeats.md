# S48 strict-budget follow-up

This diagnostic repeats the adverse S48 measurement from the complete slow
acceptance run. Routing source, fixture, expectations, strict DRC and the
300-second budget stay unchanged. Each sample starts a fresh process; the fresh
pair runs enabled first, then disabled. The prior full-suite pair ran disabled
first. This is one additional sample per mode, not a statistical demonstration
of nonregression or a new complete slow-suite run.

`runRoute` calls `recoverRemaining` only after normal passes and optimisation,
with `!outcome.timedOut`. A time-budget stop therefore bypasses recovery. The
enabled flag additionally records one monotonic timestamp at pipeline entry;
normal passes still use their existing `Date.now()` deadline from `createCtx`.
Source inspection identifies no recovery search in the normal stage. This does
not establish what caused a difference in budget-limited progress.

Reproduce from the router repository, using unused output paths:

```bash
mkdir /tmp/s48-captures
taskset -c 12-19 nice -n 10 timeout 380s bun docs/pr-assets/agent-fab-router-perf-local-rescue/repeat-strict-budget.ts candidate /tmp/s48-captures/candidate-1.json
taskset -c 12-19 nice -n 10 timeout 380s bun docs/pr-assets/agent-fab-router-perf-local-rescue/repeat-strict-budget.ts normal /tmp/s48-captures/normal-1.json
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/report-strict-budget.py /tmp/s48-captures /tmp/s48-report
```

The chart generator requires matplotlib. The runner verifies source hashes
before/after each sample and retains the full original case and expectations.
The report verifies the same source/board/settings, actual acceptance outcomes,
zero added exact violations and the time-budget stop. These are engine exact-DRC
measurements; native checking belongs to the separate full frozen suite.

## Captured results

Same machine and cores 12–19. Each row is one evaluation per mode, with the
original 300-second budget. The original pair is retained from cycle 32; the
fresh pair is cycle 33, in reverse mode order and separate fresh processes.

| Pair | Incomplete off → on | Passes off → on | Added exact violations | Vias off → on | Length mm off → on |
|---|---:|---:|---:|---:|---:|
| Original full-slow pair | 18 → 19 | 9 → 8 | 0 → 0 | 185 → 181 | 4725.244 → 4657.970 |
| Fresh targeted pair | 18 → 18 | 10 → 10 | 0 → 0 | 185 → 185 | 4725.244 → 4725.244 |

All four evaluations pass the existing acceptance expectations, retain the 16
pre-existing exact violations and stop on the time budget; recovery is skipped.
The fresh pair has identical measured quality and item counts. Sessions were
not captured by this runner, so no session-byte invariance claim is made.
The earlier adverse difference did not recur in this pair. Enabled progress
also differs between its original and fresh evaluation. This is evidence of
timing-sensitive outcomes; it does not establish a cause or an all-input
nonregression guarantee. Default enablement remains deferred.

Recheck captures, rebuild the chart and run six rejection controls plus the
positive control with the same Python environment:

```bash
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/check-strict-budget-report.py /tmp/s48-captures /tmp/s48-controls
```
