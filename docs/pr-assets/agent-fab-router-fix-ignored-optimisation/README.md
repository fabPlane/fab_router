# Preserve ignored nets during optimisation

`ignoreNetGroups` promises that those nets' items remain on the board (N-07).
When a Layout already contains free router copper from an earlier route call, the
optimiser still visited its vias and tracks. Its incomplete-count guard excluded
those same nets, so deleting their only inter-layer connection appeared safe.
The route report also excluded the newly disconnected net. The fix skips ignored
nets in both via elimination and track straightening, before any journal mutation.

The committed synthetic fixture has two surface pads on opposite layers, two
tracks and one essential via. It is independent of the frozen benchmark boards.
Three identical runs against main each changed zero incompletes to one and removed
the via; the candidate preserves every track/via record and zero incompletes in all
three. Four regression tests cover via preservation, exact track geometry, active
net optimisation and the public route API. The active control still shortens the
bent track and preserves its essential via with zero violations.

## Reproduce the regression and audits

From the repository root, with Bun installed:

```bash
bun test test/ignored-optimisation.test.ts
bun run typecheck && bun run check:layers && bun run test
```

To compare against main without editing this checkout (all paths below are under
an existing scratch directory of your choice):

```bash
scratch="$HOME/bench/agents/codex-fabpcb-bugs/scratch/c12-reproduce"
mkdir -p "$scratch/baseline"
git archive 69cf598 | tar -x -C "$scratch/baseline"
cp test/ignored-optimisation.test.ts "$scratch/baseline/test/"
cp test/helpers/ignored-optimisation.ts "$scratch/baseline/test/helpers/"
# Expected: 1 pass, 3 fail on main; 4 pass, 0 fail on the candidate.
for repeat in 1 2 3; do
  taskset -c 20-25 nice -n 10 bun test "$scratch/baseline/test/ignored-optimisation.test.ts"
  taskset -c 20-25 nice -n 10 bun test test/ignored-optimisation.test.ts
done
assets=docs/pr-assets/agent-fab-router-fix-ignored-optimisation
bun "$assets/audit.ts" "$scratch/baseline" "$scratch/before.json"
bun "$assets/audit.ts" . "$scratch/after.json"
python3 "$assets/render.py"
```

`before.json` / `after.json` retain all three public-API runs, their complete copper
geometry and unfiltered connectivity checks. The image plots the first pair's
actual track coordinates, with separate layer colours and the missing/preserved
via. It is a regression illustration, not a native benchmark rendering.

## Frozen native nonregression sweep

From the integration worktree, without changing its frozen inputs or configuration:

```bash
cd "$HOME/bench/wt/fp-bugs"
taskset -c 20-25 nice -n 10 timeout 2700 python3 benchmarks/autorouter/benchmark.py \
  --router fab-router --fab-router-source "$HOME/bench/wt/fr-bugs" \
  --out "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c12-after-full"
```

The baseline is the completed `c1-before-full` main sweep on the same machine and
cores, with the same 26 cases, three repeats, seeds, order, inputs, configuration,
harness and runtime hashes. Candidate executable source is commit `cd3ba3f`;
the harness recorded main HEAD because routing began before the source commit was
created. The validator verifies every captured candidate source hash rather than
relying on that HEAD field.

```bash
cd "$HOME/bench/wt/fr-bugs"
python3 docs/pr-assets/agent-fab-router-fix-ignored-optimisation/compare.py \
  "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full" \
  "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c12-after-full" . \
  docs/pr-assets/agent-fab-router-fix-ignored-optimisation/benchmark-summary.json
```

This path normally imports file-origin retained copper, so the frozen sweep is
nonregression coverage; the tiny repeated-call fixture exercises the repaired
router-origin path. No frozen-board completion or thermal-preservation improvement
is claimed. Shared-host timing with overlapping tests is descriptive only.
