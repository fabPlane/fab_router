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

There is a second limitation: `recoverRemaining` returns `dirty-baseline` before
searching whenever exact DRC reports existing violations. S48 retains 16 such
violations. Even with spare time, the current helper would not propose copper
on that state. The timed measurements exercise the pipeline's timeout gate;
this additional conclusion comes from source inspection, not from an extra
under-budget S48 run.

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

## Fresh full native verification

The unchanged source also received another complete 26-case × three-repeat
sweep per mode before publication. Samples, required checks and the two sweeps
run sequentially on the same cores. Per-case median/p95, pass, opens, native
errors, vias and length are in `strict-budget-checks/native-tables.md`; full
paired findings and fingerprints are in `native-comparison.json`. The older
cycle-32 suite remains under `public-checks/`. The targeted S48 samples above
are separate from this native suite.

Reproduce on the configured benchmark machine with unused output paths:

```bash
cd "$HOME/bench/wt/fp-perf"
taskset -c 12-19 nice -n 10 timeout 2400s python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$HOME/bench/wt/fr-perf" --out /tmp/s48-native-off
taskset -c 12-19 nice -n 10 timeout 2400s python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$HOME/bench/wt/fr-perf/docs/pr-assets/agent-fab-router-perf-local-rescue/public-setting" --out /tmp/s48-native-on
cd "$HOME/bench/wt/fr-perf"
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/compare-public-native.py /tmp/s48-native-off /tmp/s48-native-on "$PWD" /tmp/s48-native-comparison.json docs/pr-assets/agent-fab-router-perf-local-rescue/public-checks/source-hashes.json
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/compare-public-warnings.py /tmp/s48-native-off /tmp/s48-native-on /tmp/s48-native-warnings.json
```

Both native sweeps completed: 39/78 passed and 13/26 valid cases each,
opens 120 → 99, known native errors 27 → 27, no introduced structured errors,
warning geometry, pass/opens/fidelity regression. All 78 sessions/quality records
within each mode match cycle 32. Total measured attempt time is
358.602 → 427.364 seconds (+19.18%); median/p95 is
1.067/17.105 → 1.132/17.095 seconds. This repeats the existing completion gain
with additional routing time; no speed gain or cause for timing variation is
claimed. Vias sum stays 2826; length sum is 58809.321 → 60080.812 mm as
connections are added. All known thermal errors remain unresolved.
