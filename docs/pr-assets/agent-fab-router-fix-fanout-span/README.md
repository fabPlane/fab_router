# Fanout via-span selection

A four-signal-layer board permits only a via spanning sheets 2–3. The previous fanout destination lookup selects sheet 0 for pads on either sheet 2 or sheet 3, then gives up because no via spans that pair. Filter destinations with the existing `pickBarrel` rule resolver before choosing one. Exact clearance, placement order, insertion, and stage budgets keep their existing paths.

`test/fanout-span.test.ts` is the regression fixture: one SMD pad and one permitted via form, with the synthetic helper supplying common board definitions. Both source-sheet orientations fail on main and pass with the fix. Five exclusion controls cover an unsupported source, disabled vias, inactive destination, ignored net group, and zero fanout item budget. Positive cases assert actual pad-to-via connectivity, retained pad records, and zero engine DRC violations. A via alone does not count as `layoutStats().fanout.escaped`, which additionally requires a track or pour beyond the via; therefore the regression uses connectivity directly.

Reproduce from the repository root (Bun 1.4+, Python 3.12; Linux cores 20–25):

```bash
bun test test/fanout-span.test.ts
python3 docs/pr-assets/agent-fab-router-fix-fanout-span/regression.py --out /tmp/fanout-span-regression
python3 docs/pr-assets/agent-fab-router-fix-fanout-span/render.py
taskset -c 20-25 nice -n 10 timeout 1800 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

The repeat script archives main `69cf598` into the requested new output directory and copies the **same** final test there. It expects five passes/two failures before and seven passes/zero failures after, three repeats each. Complete logs and test/source hashes are alongside this file. These are synthetic regressions, not native benchmark task scores.

Native sweep, from the separate integration checkout with its private runtime:

```bash
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c45-after-full
```

The existing fanout item-budget fix in PR #16 edits a different part of `runFanout`; preserve both changes when integrating. Current performance branches edit geometry predicates, not this destination lookup. This fix only rejects destinations with no spanning via. It does not search every alternate layer after a physically blocked placement or resolve native thermal metadata gaps.
