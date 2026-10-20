# Preserve legacy drawings during thermal proposal generation

The original source has three `gr_circle` objects with the same legacy UUID.
The proposal generator treated these immutable drawings as ambiguous route items
and aborted before emitting any candidate. The fix permits repeated identities
only when every colliding item is a recognized drawing. Track, arc, via,
footprint, zone and unknown-item collisions still reject. Drawing nodes remain
unchanged in every proposal. Native acceptance, source copper/rules/pads/zones,
net ownership, source/current terminal pairs and open budgets remain protected.

Implementation: `a8f7762467b97863032a55e3b924dfd199456dac`.
Control: `926485d2`, with executable `src/` and `tools/` identical to the previous
integration pin `34f33a19`. All 77 measured source hashes match the implementation.
The behavioral regression fails first on the control and passes after the fix.

Same host `hyper-ms-lin`, cores 20–25, native 10.0.6; three generator trials on
exactly the same retained complete-board input with all 63 generated power-net items:

| Generator result | Before | After |
|---|---:|---:|
| Successful generation | 0/3 | 3/3 |
| Proposals per trial | 0 | 158 |
| Original drawing nodes retained | abort | all |

All candidate bytes match across the three after trials. Independent Decimal
inventory and report/partition replay passes. One standalone search per version:
before aborts with exit 2; after completes with normal rejection (exit 1), checking
270 proposals over two stages. Stage 0 candidate 101 removes U1.53's thermal,
2→1 errors, retaining 95 opens, zero lost source/current pairs and native ownership.
Stage 1 exhausts all 168 candidates. Final validation retains one U1.55 thermal;
no bundle publishes and caller boards/rules remain byte-identical (caller still has
two thermals). This standalone control does not establish recovery inside the
adapter's unchanged 600-second cap or a complete-case repair.

A one-item reduction `thermal55-added.sexpr` adds only segment
`526748ae-cdba-488b-9c2f-37172461148a` to the original source. Three fresh paired
native decisions each give source 0 errors/110 opens versus one track 1 U1.55
thermal/111 opens; both preserve all source pairs and native ownership. The track
is 0.6518 mm long, centreline about 1.201 mm from the pad centre. This is minimal
in added-item count, not a minimized source board. Deleting copper is a diagnostic,
not a repair. All 45 discovery/refill attempts are retained; every submitted/native
physical copper and net inventory matches. Removing that single track in the full
466-item context does not clear the finding: alternative obstructions remain.
Six original width-scaled variants in the original 63-item power context also fail.

Porting only the found U1.53 detour into the previous manually reconnected full
context yields three fresh paired checks: 7→6 thermals, 13→13 opens,
235→235 lost source pairs, 0→0 lost current pairs; all ownership checks true.
Only one generated segment becomes three at the same endpoints. Relative checks
accept, strict final checks reject both versions. Initial exploratory decision is
also retained. This is a manual diagnostic, not a scored output or automatic repair.

Two FRESH complete single-engine runs, 26 frozen cases × seeds 1/2/3 each:

| Opt-in pipeline | Before | After |
|---|---:|---:|
| Checked attempts | 78 | 78 |
| Passing attempts | 45/78 | 45/78 |
| Cases passing 3/3 | 15/26 | 15/26 |
| Opens | 120 | 120 |
| New native thermal errors | 18 | 18 |
| Observed median route-path seconds | 9.178637 | 9.448480 |

All 78 outcomes, warnings/fidelity/integrity policy, physical copper, DSNs and
sessions match. Six existing repairs preserve their successful proposal sequences
and accepted checkpoint geometries. All inputs, harness/runtime hashes, settings,
seeds, order and CPU affinity match; copied configs differ only by engine checkout.
Every attempt completed and was checked. Concurrent tests/search and other host
work prevent a speed inference. A separate fresh stock control also completed all
78 attempts: 39 pass, 13/26 valid, 120 opens and 27 thermal errors, matching retained
stock outcomes. These are single-engine measurements, not a five-engine ranking.

Final FROZEN-source required command: typecheck passed; layers 65 files/zero
violations; 931 tests/zero failures/398961 assertions, 1094.80 seconds. Earlier
in-flight command also passed 931 tests; the frozen rerun removes edit-timing
ambiguity. Focused native regression passes 15 assertions; pure generator suite
passes six tests/50 assertions. No assertions, timeouts or native rules were weakened.
An initial comparison script referenced old output directory names; its failure
log is retained, paths corrected, final comparison passes without changing checks.

## Reproduce from the engine repository root

```sh
asset=docs/pr-assets/agent-fab-router-native-drc-gate/c216-legacy-drawing-ids
mkdir -p /tmp/c216-evidence
tar -xJf "$asset/native-evidence.tar.xz" -C /tmp/c216-evidence
tar -xJf "$asset/benchmark-evidence.tar.xz" -C /tmp/c216-evidence
python3 /tmp/c216-evidence/verify.py /tmp/c216-evidence
python3 /tmp/c216-evidence/compare.py /tmp/c216-evidence
# Expected old generator exit 1; fixed generator exit 0 with 158 proposals:
python3 /tmp/c216-evidence/old-native-thermal-proposals.py --source /tmp/c216-evidence/search-inputs/input.kicad_pcb --current /tmp/c216-evidence/search-inputs/routed.kicad_pcb --report /tmp/c216-evidence/search/baseline.json --out /tmp/c216-old-proposals
python3 tools/native-thermal-proposals.py --source /tmp/c216-evidence/search-inputs/input.kicad_pcb --current /tmp/c216-evidence/search-inputs/routed.kicad_pcb --report /tmp/c216-evidence/search/baseline.json --out /tmp/c216-new-proposals
taskset -c 20-25 nice -n 10 timeout 600 bun /tmp/c216-evidence/recheck.ts /tmp/c216-fresh-checks
taskset -c 20-25 nice -n 10 timeout 2400 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

For fresh paired corpus runs, create isolated engine checkouts at `926485d2` and
`a8f77624`, then use new config and result directories for each source:

```sh
# Run from /home/hyper/bench/wt/fp-bugs; engine is one of those exact checkouts.
python3 packages/router/bench/native-thermal-config.py --engine "$engine" --out "$configs"
taskset -c 20-25 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$engine" --config-dir "$configs" --out "$results"
```

Actual before source/config/output paths were
`/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c216/before-control`,
`optional-before-configs`, `optional-before`; after source was
`/home/hyper/bench/wt/fr-bugs`, with `optional-after-configs`, `optional-after`.
All commands and raw evidence are retained in the archives. Native replay verifies
retained reports/inventories rather than rerouting. Licenses are included.

![One-track thermal reduction](https://github.com/fabPlane/fab_router/blob/agent/fab-router-native-drc-gate/docs/pr-assets/agent-fab-router-native-drc-gate/c216-legacy-drawing-ids/comparison.png?raw=true)

Exact paired corpus reproduction (new directories; engine repository first):

```sh
git worktree add -b agent/c216-repro-before /tmp/c216-source-before 926485d2
git worktree add -b agent/c216-repro-after /tmp/c216-source-after a8f77624
cd /home/hyper/bench/wt/fp-bugs
python3 packages/router/bench/native-thermal-config.py --engine /tmp/c216-source-before --out /tmp/c216-config-before
taskset -c 20-25 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /tmp/c216-source-before --config-dir /tmp/c216-config-before --out /tmp/c216-results-before
python3 packages/router/bench/native-thermal-config.py --engine /tmp/c216-source-after --out /tmp/c216-config-after
taskset -c 20-25 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /tmp/c216-source-after --config-dir /tmp/c216-config-after --out /tmp/c216-results-after
```
