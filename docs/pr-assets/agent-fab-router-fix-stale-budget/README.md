# Search expansion budget regression

An improved path can leave an obsolete entry for the same directional state in the A* heap. Previously that entry consumed `maxPops` even though the stale-entry check skipped all graph expansion. On the 30×30 wall-and-gap fixture, both search variants gave up at 4,001 raw pops, while an unchanged high-budget control found the detour after 4,437 raw pops.

The candidate charges `maxPops` only for current-best entries. It retains raw `pops` for diagnostics and cancellation/deadline polling every 256 heap removals. Thus returned `pops` may exceed `maxPops`. The neighbor order, costs, clearance callbacks, and heap ordering are unchanged. This is a search policy change, with the same wall-clock and cancellation bounds. Every expanded state queues only its finite set of neighbor moves; discarding stale entries cannot create new work.

The active regression in `test/search-budget.test.ts` was run before the source change: four controls passed and both reachable-detour tests failed. Three repeats of the exact test against each source reproduced those results. The candidate passes all six tests, including insufficient-budget, cancellation, and expired-deadline controls. Successful low-budget paths match the high-budget controls.

| Engine-only fixture, three repeats per source | Original `69cf598` | Candidate `76534d6` |
| --- | ---: | ---: |
| Single-layer detour found | 0/3 | 3/3 |
| Layered detour found | 0/3 | 3/3 |
| Focused tests, each repeat | 4 pass / 2 fail | 6 pass / 0 fail |
| Raw pops on fixture, both variants | 4,001, failed | 4,437, succeeded |

`before-grid.json` and `after-grid.json` preserve all paths and raw counts. `regressions.json` hashes all six portable rerun logs. `candidate-source.json` identifies the measured engine bytes. `checks.json` records the full required candidate checks. The engineering image is generated from the measured successful path by `render.py`, without image generation.

Reproduce the six before/after focused test runs from this checkout with Bun dependencies installed:

```bash
python3 docs/pr-assets/agent-fab-router-fix-stale-budget/reproduce.py --out /tmp/stale-budget-repeats
bun docs/pr-assets/agent-fab-router-fix-stale-budget/probe.ts "$PWD/src/route/search.ts"
python3 docs/pr-assets/agent-fab-router-fix-stale-budget/render.py
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Run the frozen native suite from the integration checkout, using separate clean output directories for original and candidate engine checkouts:

```bash
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /path/to/engine-checkout --out /path/to/new-results
```

This grid does not represent physical PCB clearances and is not a minimization of the larger no-via board. Existing native thermal failures require separate native-aware protection. The candidate does not claim to fix them or to meet routing completion on that board.

## Full frozen native comparison

All 26 cases × three repeats completed on the same host and cores 20–25, with identical inputs, configs, harness/checker, runtime/source, schedule and seeds. All 74 measured candidate source hashes match commit `76534d6`. The harness captured HEAD `69cf598` before the source change was committed; content hashes identify the measured candidate unambiguously.

| Native suite metric | Original | Candidate |
| --- | ---: | ---: |
| Passed attempts | 39/78 | 39/78 |
| Cases passing 3/3 | 13/26 | 13/26 |
| Opens | 120 | 120 |
| New errors, all thermal starvation | 27 | 27 |
| Median route seconds | 1.172079 | 1.326766 |

Every attempt's pass/open/error-type/fidelity/via/track-length values are identical. `native-comparison.json` records all candidate attempt values, matching-control flags and full-evidence hashes; both original control manifests are included. The run is a full single-router sweep, not the five-router suite. Time is descriptive only: the machine is shared and engine tests overlapped the first part of the candidate sweep. The observed median increased 13.2%; no speed gain or isolated timing nonregression is claimed. Existing native thermal errors remain unresolved.

## Original no-via board comparison

The synthetic success does not transfer to the original Issue026 no-via board. Cycle 71 compared unmodified archives of `69cf598` and `76534d6`, three repeats each on the same host and cores 20–25. The DSN, case settings, runner, and expectations are byte-identical, verified before and after execution. Engine/type source hashes and all six raw reports/logs are under `no-via/`.

| Engine acceptance, three repeats per source | Original | Candidate |
| --- | ---: | ---: |
| Acceptance passes (existing limit: six opens) | 0/3 | 0/3 |
| Opens, every repeat | 12 | 12 |
| Added engine DRC violations / vias, every repeat | 0 / 0 | 0 / 0 |
| Added tracks / total track length, every repeat | 21 / 116.022233 mm | 21 / 116.022233 mm |
| Fresh-input capped pairs connected, every repeat | 0/5 | 0/5 |

Both full routes stop as stagnant, without timeout or cancellation. The five previously identified capped pairs (nets 2, 4, 5, 7, 9) were additionally tried independently on fresh input, with rip-up and optimization disabled. Each endpoint passes exact point clearance; each attempt preserves retained copper, adds no engine DRC violations, and reports failure consistent with rebuilt terminal connectivity. All five fail on both sources in all three repeats. This establishes that the budget fix alone does not complete those pairs; it does not establish geometric impossibility or identify the remaining root cause. These are engine diagnostics, without native refill/checker or adapter coverage.

```bash
python3 docs/pr-assets/agent-fab-router-fix-stale-budget/acceptance.py --out /tmp/stale-budget-no-via
python3 docs/pr-assets/agent-fab-router-fix-stale-budget/pairs.py --acceptance-out /tmp/stale-budget-no-via
python3 docs/pr-assets/agent-fab-router-fix-stale-budget/no-via/render.py
```

The first command runs the unchanged acceptance CLI six times, each with an explicit 180-second process timeout. The second runs `pairs.fixture.ts` against those same archived sources; it does not instrument or edit the engine. `pairs-comparison.json` hashes all diagnostic outputs and the fixture. Wall-clock samples are descriptive shared-host measurements with overlapping checks, without a speed claim. Existing native thermal errors remain unresolved; the previous full native comparison remains separate and was not rerun for this evidence-only extension.
