# Shared recovery deadline and cancellation

The explicit research adapter now forwards normal routing hooks and supplies one
absolute monotonic deadline to the entire recovery call. Its origin is immediately
before calling normal routing; parsing and initial statistics precede it. Normal
routing keeps its existing clock implementation. This is a conservative wrapper
budget, not a change to the production route clock or public settings.

Recovery checks before setup, after collecting pending links and checking baseline
DRC, between targets, before each region, and at charged search work. A transaction
checkpoint runs before/after the proposal and after final exact geometry and
terminal validation. A stop observed at the final checkpoint rewinds the proposal
and live index. Earlier accepted targets remain. Route-wide stops are distinct
from a per-target budget stop: the adapter sets `aborted`/`timedOut` and `stoppedBy`,
and the collector does not start another target. Already completed boards return
after connection collection without constructing a recovery DRC baseline/index.

The mechanism is cooperative. Synchronous connectivity, index construction and
exact validation cannot be interrupted; overruns are detected at the following
checkpoint. An AbortSignal changed by an ordinary same-thread timer cannot fire
until synchronous routing yields. This adds no asynchronous scheduling, hard
preemption, worker isolation or bound on validation cost. Progress events still
cover normal routing only. All code remains explicitly invoked research under
PR assets; no production import, option or default is added.

Regressions cover initial abort/deadline, partial proposal rollback, cancellation
after successful exact validation, unchanged sessions/index, disabled controls,
completed inputs, and real-board adapter hook/deadline propagation. Clock tests
use a controlled monotonic clock; they are not latency measurements. The real
all-net closure regression still requires six links before/four after with zero
engine violations. Two independent mutations remove the final checkpoint or
ignore the shared control; each fails its intended test while the control passes.

```bash
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
taskset -c 12-19 nice -n 10 timeout 1200 bun run acceptance -- --tier slow --report /tmp/recovery-slow.json
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/cancellation-checks/check-mutations.py /tmp/UNUSED-recovery-mutations
```

Use an unused output directory for each native sweep, from the benchmark checkout:

```bash
taskset -c 12-19 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-perf --out /tmp/UNUSED-normal
taskset -c 12-19 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-perf/docs/pr-assets/agent-fab-router-perf-local-rescue/candidate --out /tmp/UNUSED-candidate
```

From the router checkout, compare controls, complete structured native findings,
sessions and quality across all attempts (never discard unsuccessful routes):

```bash
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/compare-remaining-native.py /tmp/UNUSED-normal /tmp/UNUSED-candidate . /tmp/UNUSED-comparison.json docs/pr-assets/agent-fab-router-perf-local-rescue/cancellation-checks/source-hashes.json
```

Full slow acceptance uses the unmodified public API, so it does not satisfy the
remaining large-input recovery integration gate. The prior Dense6/L3 trials timed
out in normal routing and did not exercise recovery. Neither those trials nor this
cancellation work establishes native safety for recovery on those stress inputs.
The 27 existing native thermal errors remain owned by the separate bug work.
