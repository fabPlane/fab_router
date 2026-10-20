# R20 full-board thermal blocker

Manual geometry diagnostic on the same retained, placement-corrected Aquarius
full board and rules, host hyper-ms-lin, cores 20–25, native checker 10.0.6.
No production generator, router, adapter, rule, scoring or frozen input changes.

| Native geometry | Repeats | Thermal errors | Opens | Lost source pairs | Lost current pairs |
|---|---:|---:|---:|---:|---:|
| Coordinated power/signal-via control | 3 fresh | 5 | 13 | 235 | 0 |
| Remove R20 blocker (diagnosis only) | 1 fresh | 4 | 14 | 235 | 2 |
| Endpoint-preserving R20 detour | 3 fresh | 4 | 13 | 235 | 0 |

Track fa3f4b5e-8a05-43e8-aacb-933e02c54760 is generated analog-ground copper.
Its segment from (176.657,58.3565) to (174.5474,56.9501) mm blocks the second
R20.1 digital-ground spoke. Removing it opens two previously connected terminal
pairs. Replacing it with three segments through (176.657,57.9065) and
(174.5474,56.5001) retains both endpoints and clears the R20 thermal with no
new errors, opens or current pair loss. The strict relative check accepts it
in all three repeats; FINAL SOURCE-BASED ACCEPTANCE REJECTS ALL THREE.
Four thermal errors (C1.2, U1.39, U1.46, U1.48) and 235 lost source pairs remain.
No output bundle is published; this is not an automatic or scored repair.

All 31 exploratory native attempts are retained: nine single generated-track
removals within 1 mm of the five markers, six existing detour shapes for R20,
and sixteen endpoint-preserving translations in four directions. The six
existing detours either leave the thermal or add other violations. Translating
the middle run by y=-0.45 or -0.60 mm clears R20; only -0.45 receives the three
strict repeated checks. One exploratory helper initially failed at module import
before a native check; another stopped after offset 0 because its timing variable
shadowed a point. Both logs are retained, and offset 1–15 completed after correction.
No completed native attempt was discarded. Deletions are diagnoses, not repairs.

The existing native regression now adds nine assertions for this partial detour
(26 total). It asserts existing native behavior, not a fail-first engine fix.
The archive retains all submitted/native-saved boards, rules, reports, terminal
groups, logs, scripts, controls and three paired strict results. The independent
verifier checks board hashes, recomputes source/current pair losses and compares
all 31 raw reports against their summaries. Source-board license remains in
`test/fixtures/native-aquarius-thermal/LICENSE`.

A fresh production Aquarius subset (three seeds) is also retained; all three still have 15 opens and six thermal errors each. All production outcomes, copper metrics, integrity results and DSN/session bytes match the retained c217 rows under identical source inputs/settings/checker/runtime/seeds/cores; see scored-comparison.json. The full scored router corpus was not rerun for this test/evidence-only change.
Latest retained same-host 26-case × three-seed results are unchanged:
default c217: 39/78 passes, 13/26 valid, 120 opens, 27 new thermal errors;
opt-in c219: 45/78 passes, 15/26 valid, 120 opens, 18 new thermal errors.
No routing speed or corpus gain is claimed; no integration pin change.

Fresh subset reproduction from the integration worktree:

```bash
taskset -c 20-25 nice -n 10 timeout 900 python3 benchmarks/autorouter/benchmark.py --router fab-router --case kitspace-aquarius-j4 --fab-router-source /home/hyper/bench/wt/fr-bugs --out /tmp/c221-aquarius-fresh
```

From the engine repository root:

```bash
taskset -c 20-25 nice -n 10 bun test test/native-aquarius-joint-power.test.ts
bun run typecheck && bun run check:layers && bun run test
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c221-r20-blocker/native-evidence.tar.xz -C /tmp
python3 /tmp/c221/verify.py
# Recheck the same control and candidate three times in a fresh work directory:
mkdir -p /tmp/c221-recheck/r20-offset-2
cp -r /tmp/c221/controls /tmp/c221-recheck/controls
cp /tmp/c221/r20-offset-2/submitted.kicad_pcb /tmp/c221-recheck/r20-offset-2/
taskset -c 20-25 nice -n 10 timeout 600 bun /tmp/c221/portable-measure.ts /tmp/c221-recheck
```
