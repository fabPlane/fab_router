Pass progress after rip-up
=========================

The local routing loop reported `starting incompletes - successful insertions`.
A successful insertion can remove another net's copper. That formula can report
zero remaining connections while the board still has an open net.

A four-pad, two-net, one-layer fixture reproduces this: a vertical retained track
blocks the horizontal connection. Later passes exchange which net is connected.
With three passes, the old callbacks report 1, 0, 0; actual connectivity remains
1, 1, 1. Both `onPass.incomplete` and `onProgress.total - done` now report 1, 1, 1.
The count comes from the live terminal connectivity, respecting ignored nets.
It is calculated only when either callback is registered. `done` retains its
existing cumulative successful-attempt meaning.

Regression was written first and failed on main. The public API audit runs
three repeats on each revision, both with and without hooks. `validate.py`
asserts every candidate event is accurate, every report/copper/DRC record is
identical across versions, and hook registration does not change those results.
The synthetic board remains incomplete with zero DRC violations: this fix changes
reporting, not routing ability. The Issue026 no-via acceptance failure and native
thermal starvation remain unresolved. This does not claim a full slow-tier pass.

Reproduce from the repository root:

```bash
audit=/tmp/pass-progress-baseline
mkdir -p "$audit"
git archive 69cf598 | tar -x -C "$audit"
taskset -c 20-25 nice -n 10 timeout 60 bun docs/pr-assets/agent-fab-router-fix-pass-progress/audit.ts "$audit" > docs/pr-assets/agent-fab-router-fix-pass-progress/before.json
taskset -c 20-25 nice -n 10 timeout 60 bun docs/pr-assets/agent-fab-router-fix-pass-progress/audit.ts "$PWD" > docs/pr-assets/agent-fab-router-fix-pass-progress/after.json
python3 docs/pr-assets/agent-fab-router-fix-pass-progress/validate.py
python3 docs/pr-assets/agent-fab-router-fix-pass-progress/render.py
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /tmp/pass-progress-native
cd /home/hyper/bench/wt/fr-bugs
python3 docs/pr-assets/agent-fab-router-fix-pass-progress/summarize.py /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /tmp/pass-progress-native --source-commit 2cc0f50
```

Use a new empty output directory for every native run. Historical baseline source
is 69cf598. Source/hash and per-case native comparison are in benchmark-summary.json.
The harness began before the source commit was made; its captured source hashes
identify the tested files. The chart is derived from the actual callback events,
not a native board render. No frozen cases, checker, rules, settings or test
expectations were changed. Runtime costs on this shared host are descriptive only.

Measured native nonregression (26 cases × three repeats, same host/cores):

| Metric | Main | Candidate |
| --- | ---: | ---: |
| Passed runs | 39/78 | 39/78 |
| Cases valid 3/3 | 13/26 | 13/26 |
| Opens, sum | 120 | 120 |
| New DRC errors, sum | 27 | 27 |
| Median route seconds | 1.172079 | 1.160610 |

Every case/seed also has identical via count and track length. Both runs completed
with controls preserved; all 74 candidate and baseline source hashes verified.
Timing is a shared-host observation, not a speed claim. This is the complete
fab_router sweep, not a five-router full benchmark. Required checks passed:
typecheck, 65 files with zero layer violations, 860 tests with zero failures and
398462 assertions (219.72 seconds).
