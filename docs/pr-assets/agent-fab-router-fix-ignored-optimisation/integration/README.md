# Integration with isolated copper cleanup

PR #8 and this change touch the same optimiser. This audit checks their composition
without changing either independent implementation. The composed snapshot is
cleanup commit `6cb4b97` plus the two ignored-net guards and this branch's four
regression tests/helper. Its executable cleanup source is `eea1256`, and the
ignored-net guards are `cd3ba3f`. Reverse pad escape is deliberately absent from
this particular composition. This is not the earlier three-fix score.

The synthetic board extends the completed two-layer ignored route with two
detached tracks: one ignored, one active. Each version is audited three times via
the public route API, with unfiltered connectivity and exact ignored-item records.

| Version | Ignored copper preserved | Active island removed | Terminal opens |
| --- | ---: | ---: | ---: |
| Cleanup only | No, 0/3 | Yes, 3/3 | 1 each |
| Ignored-net guards only | Yes, 3/3 | No, 0/3 | 0 each |
| Both fixes | Yes, 3/3 | Yes, 3/3 | 0 each |

All nine calls add zero engine violations. Each preserves the detached ignored
track. The combined result preserves every ignored track/via record exactly.
Full before/after geometry and reports are in the three JSON files. The PNG/SVG
render those records; they are not a native frozen-board image.

## Reproduce

From this branch's repository root, using an empty scratch directory under `~/bench`:

```bash
assets=docs/pr-assets/agent-fab-router-fix-ignored-optimisation/integration
scratch="$HOME/bench/agents/codex-fabpcb-bugs/scratch/c13-reproduce"
mkdir -p "$scratch/cleanup" "$scratch/composed"
git archive 6cb4b97 | tar -x -C "$scratch/cleanup"
git archive 6cb4b97 | tar -x -C "$scratch/composed"
git -C "$scratch/composed" apply "$PWD/$assets/guards.patch"
cp test/ignored-optimisation.test.ts "$scratch/composed/test/"
cp test/helpers/ignored-optimisation.ts "$scratch/composed/test/helpers/"
ln -s "$PWD/node_modules" "$scratch/composed/node_modules"
bun "$assets/audit.ts" "$scratch/cleanup" "$scratch/cleanup.json" cleanup
bun "$assets/audit.ts" . "$scratch/ignored.json" ignored
bun "$assets/audit.ts" "$scratch/composed" "$scratch/composed.json" composed
(cd "$scratch/composed" && taskset -c 20-25 nice -n 10 timeout 1200 bash -c \
  'bun run typecheck && bun run check:layers && bun run test')
python3 "$assets/render.py"
```

For the native benchmark, initialise and commit the composed snapshot (the
harness requires Git metadata), then run from the integration checkout:

```bash
cd "$HOME/bench/wt/fp-bugs"
taskset -c 20-25 nice -n 10 timeout 2700 python3 benchmarks/autorouter/benchmark.py \
  --router fab-router \
  --fab-router-source "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c13/composed" \
  --out "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c13-composed-full"
```

The comparison command checks all 78 identities, immutable control hashes,
source hashes, and equality of pass/open/error/via/length outcomes against the
previous cleanup-only sweep on the same machine, cores, cases and three repeats:

```bash
python3 docs/pr-assets/agent-fab-router-fix-ignored-optimisation/integration/compare.py \
  "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c9-after-full" \
  "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c13-composed-full" \
  "$HOME/bench/agents/codex-fabpcb-bugs/scratch/c13/composed" \
  docs/pr-assets/agent-fab-router-fix-ignored-optimisation/integration/benchmark-summary.json
```

Shared-host timings with overlapping tests are descriptive, not a speed claim.
The guards fix repeated route calls on router-origin copper; frozen inputs retain
file-origin copper, so their sweep provides nonregression coverage.

## Required checks

Both independent and composed snapshots pass typecheck and the layer checker
(65 source files, zero violations). The independent suite passes 863 tests with
398471 assertions (229.90 seconds); the composed suite passes 875 tests with
398493 assertions (233.49 seconds), zero failures each. No golden expectations
were changed for this integration. `checks.json` records source identities and
complete log hashes. `guards.patch` was applied to the cleanup source in a fresh
scratch directory and byte-compared against the tested optimiser.

## Native results

Measured on hyper-ms-lin, cores 20–25, the same 26 cases × three repeats:

| Metric | Cleanup only | Both fixes |
| --- | ---: | ---: |
| Passing attempts | 39/78 | 39/78 |
| Cases passing 3/3 | 13/26 | 13/26 |
| Native opens | 99 | 99 |
| New native DRC errors | 24 | 24 |
| Median route-path seconds | 1.142672 | 1.132143 |

Every case/seed has identical pass/open/error/via/length outcomes. Both sets of
source hashes and all immutable controls match their intended sources. All 24
remaining new errors are thermal starvation; this integration does not fix them.
Median time decreased 0.9% descriptively on a shared host with overlapping tests.
No speed or additional frozen-board completion improvement is claimed.
