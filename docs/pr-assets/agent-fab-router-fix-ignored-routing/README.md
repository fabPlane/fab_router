# Ignored routing obstacles

The routing ladder excluded ignored nets from connection work but still treated their free
tracks and vias as movable victims. The shared victim predicate now accepts the driver's
ignored-net set. All five soft-search predicate call sites and the nudge/shove entry points
carry that set; recursive shoves keep it when checking neighbours of the moved track.
Ignored copper remains present in exact clearance queries.

The fixture is original synthetic geometry adapted from the existing shove tests: one sheet,
four locked pads and one free, file-origin obstacle track, on a 20 × 20 mm board. The wall
closes the board to the active connection. Preserving it correctly leaves one active open;
completion by moving or deleting ignored copper violates N-07. No native-board completion
improvement is claimed. The optional detailed loop also has a separate keep-best snapshot
bug addressed by PR #14; unignored controls here intentionally retain that baseline behaviour.
This fix is independent of PR #9's optimiser mutation guards, which are still needed.

## Reproduction

Run from this repository root with Bun and `rsvg-convert` installed. The synthetic audit runs
48 routes per version: two negotiation modes × shove off/on × ignored/unignored × three repeats.

```bash
ASSET=docs/pr-assets/agent-fab-router-fix-ignored-routing
SCRATCH=/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c19-reproduce
mkdir -p "$SCRATCH/main"
git archive 69cf598 | tar -x -C "$SCRATCH/main"
cp test/helpers/ignored-routing.ts "$SCRATCH/main/test/helpers/"
taskset -c 20-25 nice -n 10 bun "$ASSET/audit.ts" "$SCRATCH/main" > "$SCRATCH/before.json"
taskset -c 20-25 nice -n 10 bun "$ASSET/audit.ts" . > "$SCRATCH/after.json"
taskset -c 20-25 nice -n 10 bun test test/ignored-routing.test.ts
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
python3 "$ASSET/render.py"
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out "$SCRATCH/native-after"
```

`before.json` and `after.json` retain all synthetic copper, reports and engine DRC findings.
The image renders the actual default-loop, shove-enabled ignored case (repeat 1); it is not a
native board render. The regression suite additionally covers protected vias, nudge rejection
before rerouting, a protected neighbour reached during shove cascade, and unignored controls.

The full frozen-suite comparison uses the completed historical main run `c1-before-full`
against this cycle's fresh `c19-after-full`, on the same machine and cores 20–25 with three
repeats per case. `validate.py` checks controls, all captured source hashes, all attempts and
rejects added opens/errors or lost passes. Run:

```bash
python3 docs/pr-assets/agent-fab-router-fix-ignored-routing/validate.py /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c19-after-full /home/hyper/bench/wt/fr-bugs /tmp/ignored-routing-summary.json
```

Timing is descriptive on a shared host; unit tests overlap part of the candidate sweep.
Independent pending fixes are excluded. Thermal starvation remains unresolved.

## Measured results

All eight final targeted regressions: main 1 pass / 7 fail; candidate 8 pass / 0 fail.
Required full checks: typecheck passed; 65 layer-checked files / zero violations;
867 tests / zero failures / 398485 assertions in 214.00 seconds.

| Frozen native suite, 26 cases × 3 repeats | Main before | Candidate after |
| --- | ---: | ---: |
| Passing attempts | 39/78 | 39/78 |
| Cases valid 3/3 | 13/26 | 13/26 |
| Opens | 120 | 120 |
| New errors (all thermal starvation) | 27 | 27 |
| Median route seconds | 1.172079 | 1.048762 |

Every attempt has identical pass/open/error/via/length metrics. The -10.5% observed median
time change is descriptive only; the shared host and overlapping tests prevent an isolated
speed conclusion. Inputs, settings, harness/runtime hashes, order, seeds and core set match.
All 74 captured candidate source hashes match source commit c4d20ff. The harness recorded
pre-commit HEAD 69cf598db98c136bff16bbe02bccdded95674b18; no executable source changed during the sweep.
