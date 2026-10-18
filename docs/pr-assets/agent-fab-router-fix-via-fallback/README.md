# Later permitted via forms

`dropViaNear` used `pickBarrel` once, then searched every offset using only that
form. A blocked first form exhausted the search even when the next permitted
form could join the same sheets with exact clearance. The fixture has one SMD
pad, one opposite-layer terminal region and two barrel keepouts. The first
1.2 mm via cannot clear the corridor; the second 0.6 mm via fits at the anchor.

The fix retains existing exact-span preference and candidate order within each
span class. It exhausts the existing target/ring search for one candidate before
trying the next. `pickBarrel` and its other search callers are unchanged; the
change applies to `dropViaNear` consumers (fanout, plane helpers, line probes and
channel routing). It does not provide fallback forms in the multilayer A* matrix.
Pending plane enumeration/stop changes also edit via.ts and need to preserve
this candidate loop when integrated. No combined validation is claimed here.

On the same host and core set, three repeats of the identical eight tests give
5 pass / 3 fail before and 8 pass / 0 fail after. The public fanout fixture has
1 open / 0 added vias before and 0 opens / 1 added via after; both have zero
engine DRC violations. Pads, permitted forms, via rules, fences and the terminal
region are preserved. Controls cover disabled fanout/vias, absent alternatives,
nonspanning alternatives and first-fitting-form priority. Raw repeated logs,
geometry and source/test hashes are in regressions.json. This is a synthetic
engine regression, not a native benchmark score or thermal preservation test.

```bash
bun test test/via-fallback.test.ts
python3 docs/pr-assets/agent-fab-router-fix-via-fallback/regression.py --out /tmp/via-fallback-repeated
python3 docs/pr-assets/agent-fab-router-fix-via-fallback/render.py
bun run typecheck && bun run check:layers && bun run test
```

The PNG renders measured synthetic geometry. Dashed outlines show the rejected
candidate, not retained copper. Searching additional forms can add clearance
work after a candidate is exhausted; no performance improvement is claimed.

## Native nonregression sweep

26 frozen cases × 3 repeats, fab_router only, on hyper-ms-lin cores 20–25.
The baseline is 69cf598; all 74 captured candidate source hashes match 1f898f4.
Inputs, configuration, checker, runtime, seeds and order match the baseline.
The harness captured the precommit main HEAD; source hashes identify the tested
candidate. No engine source changed during this sweep.

| Metric | Before | After |
| --- | ---: | ---: |
| Passing attempts | 39/78 | 39/78 |
| Cases valid 3/3 | 13/26 | 13/26 |
| Native opens, total | 120 | 120 |
| New native errors, total | 27 | 27 |
| Median route seconds | 1.172079 | 1.121041 |

All per-attempt pass/open/error-type/via/length outcomes are unchanged. Remaining
native errors are thermal starvation; this fix does not repair them. Timings are
descriptive shared-host measurements with test overlap; no speed claim.

```bash
cd "$HOME/bench/wt/fp-bugs"
taskset -c 20-25 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$HOME/bench/wt/fr-bugs" --out "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c48-after-full"
cd "$HOME/bench/wt/fr-bugs"
python3 docs/pr-assets/agent-fab-router-fix-via-fallback/summarize.py "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full" "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c48-after-full" --source-commit 1f898f4
```

Use a new output directory when repeating the native run. Source, per-attempt
metrics and control comparison are recorded in benchmark-summary.json. Final
required checks passed: typecheck; 65 files, zero layer violations; 867 tests,
zero failures, 398476 assertions (223.21 seconds). checks.json records hashes.

## Plane-candidate integration audit

The pending plane-contact change also edits `via.ts`. `composition.py` creates
four isolated snapshots from pinned commits: main 69cf598, via fallback 1f898f4,
plane contact 8aff4ae, and their composition. The composition keeps the plane
iterator/stop checks and exhausts its placements for each permitted form before
advancing to the next form. `composition.patch` records the exact adaptation
relative to the pinned plane source; this branch's engine remains independent.

Identical 27 regression tests, same host/cores 20–25, three repeats per source:

| Source | Passing per repeat | Failing per repeat |
| --- | ---: | ---: |
| Main | 9 | 18 |
| Via fallback | 12 | 15 |
| Plane contact | 24 | 3 |
| Combined | 27 | 0 |

Three additional integration checks run three times on the combined source:
blocked first form falls through without mutating the board; rejecting a yielded
placement allows a different form at the same location; cancellation after a
yield prevents clearance queries for the next form. Existing tests cover actual
plane contact, requested-component identity, rollback, and blocked-scan aborts.
`integration.ts` is installed into the isolated snapshot by the script.

```bash
python3 docs/pr-assets/agent-fab-router-fix-via-fallback/composition.py --out /tmp/via-plane-composition
```

Use a fresh output directory. The script also runs the combined typecheck,
layer check and full test suite. Raw repeated logs, source/test hashes and the
full-check log hash are retained in `composition.json`. This is synthetic
integration evidence; no combined native routing or performance result is claimed.
The independent native results above remain the measured native coverage.

Final combined checks passed: typecheck; 65 files with zero layer violations;
889 tests, zero failures, 398669 assertions. Independent branch checks passed:
867 tests, zero failures, 398476 assertions. Production source is unchanged.
