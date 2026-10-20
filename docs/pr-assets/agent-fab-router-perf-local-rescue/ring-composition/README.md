# Exact ring containment composed with optional recovery

This measurement adds the existing exact ring predicate optimization from implementation `8dddcad6` to the recovery/cache source at `ff199fea`. The candidate production revision is **b65bcf03945ca2aa9704b2e196e089f0aaa60a8d**. Only `src/geom/predicates.ts` changes in production; the existing differential ring test is added. Both sides enable `localRecovery` identically. Recovery remains off by default in the engine and consumer adapter.

An edge strictly outside the query's closed y interval cannot contain the query or cross its ray. Remaining edges reuse one exact cross product for boundary membership and ray direction. The boundary x interval and half-open ray convention remain intact. No geometry, rule, clearance, width, lattice, search budget or seed changes.

## Full native result

The same 26 frozen cases × three seeds run on `hyper-ms-lin`, CPUs 12–19, nice 10, with candidate FIRST and then control. Own heavy jobs do not overlap. Every attempt is retained, including failed boards in the timing totals. p95 uses nearest rank; per-case p95 is the maximum with only three repeats. This is not a multi-router ranking. All 78 paired sessions, final statistics and complete reports except wall clock are identical. Native findings, warning geometry, fidelity, vias and length do not regress. Both sides retain **48/78 passes, 16/26 valid cases, 90 opens and 27 known native thermal errors**. The errors remain unresolved; this is not a DRC-clean result or a default-setting score.

Total route time falls 3.29%, overall p95 falls 13.04%, and controls-recorded sweep wall falls 2.54%. Overall median rises 0.08%; only 17/26 case medians and 14/26 case p95 improve, and summed case p95 rises 1.52%. These shared-host observations do not establish a universal or causal speedup. `aggregate-table.md` and `table.md` contain all metrics, including adverse cases. CLI supervisor wall is separately retained in `*-supervisor.json`.

This delta isolates ring containment on an already cached source. It does **not** establish a standalone cache benefit: the prior reverse-order full comparison had median +0.15% and p95 +4.07%, and the latest cache-only warmed slow-case median worsened 9.00%. Those records remain in `../quilt-front-reverse/` and `../quilt-counterbalanced/`.

Three alternating unprofiled slow-case pairs (two routes/process) preserve all twelve sessions, reports except wall, statistics and settings. First-route median is 52.771915→49.886988 seconds; warmed median is 56.931532→50.910525. Profiling is separate and excluded from timing aggregates; inlining can move sampled attribution between functions.

Dense6: three alternating pairs, all six SES/statistics identical,181 opens/0 new native errors/315 vias/2317.561458 mm each. Median regresses158.700070→162.755213s(+2.56%); p95(max3) improves 169.190716→166.367380s(−1.67%). L2/L3 each have one paired run with identical SES/statistics/reports except wall,21/153engine incompletes and 0 added represented-rule violations. Times regress 20.688960→20.854310s and 179.580428→180.969654s. Dense fixture files and their original hashes are retained in `dense-raw.json.gz`; ladder inputs are retained in `ladder-records.json.gz`. These stress timing regressions remain visible alongside the favorable native total.

Fresh production gate passes: typecheck, layer checks, **913 unit tests / zero failures**. The added ring differential regression compares 207966 decisions including vertices, degenerate/repeated edges, winding and large coordinates against the original predicate. Fresh enabled slow acceptance completes all 63 unchanged cases: **51 pass, 12 existing failures, 14 advisory, 0 stubs**. Pass count, represented-rule violations and invariants do not regress against the historical source-matched control, but one 300-second case retains **19 incompletes versus 18 historically** (both pass), initially blocking adoption. Three fresh alternating pairs then compare control [18, 18, 18] versus ring [18, 18, 18] incompletes, with no adverse pair. This fresh isolated check does not explain the historical difference or establish all-input nonregression. All differences and the initial blocked-gate log remain archived; this is not fresh paired whole-slow-suite timing.

| Sampled self time, one separate route/mode | Control ms | Ring ms |
|---|---:|---:|
| pointInRing (geom/predicates) | 11939.296 | 13.539 |
| onSeg (geom/predicates) | 11.583 | 15.643 |
| withinRim (geom/onboard) | 3200.269 | 10835.214 |
| collect (lattice/grid) | 6083.239 | 5997.557 |
| test (lattice/grid) | 3302.794 | 3242.432 |

Inlining and sampling can move attribution between functions; these are not causal CPU-cost estimates or a claim that predicate work vanished. Profiled elapsed times do not enter any timing table.

## Exact reproduction

Use an engine Git checkout containing both revisions, installed engine dependencies, and a benchmark checkout with its private native runtime already installed. Do not modify shared runtimes, frozen fixtures, rules or checker. Run sequentially on the same host:

```bash
ENGINE=/home/hyper/bench/wt/fr-perf
ASSET="$ENGINE/docs/pr-assets/agent-fab-router-perf-local-rescue/ring-composition"
RUN=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/ring-composition-repro
python3 "$ASSET/prepare-repro.py" "$ENGINE" "$RUN" ff199fea b65bcf03945ca2aa9704b2e196e089f0aaa60a8d
python3 "$RUN/native.py"
```

`prepare-repro.py` creates isolated snapshots and identical wrappers that explicitly enable recovery. `native.py` uses the existing private benchmark checkout at `/home/hyper/bench/wt/fp-perf`, sequentially runs both complete 26×3 sweeps with 3000-second outer timeouts, retains command exits/logs, and compares controls and native evidence. Its inner command is:

```bash
cd /home/hyper/bench/wt/fp-perf
taskset -c 12-19 nice -n 10 timeout --kill-after=5 3000 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$RUN/candidate/entry" --out "$RUN/native-candidate"
```

The same command then uses `original/entry` and `native-original`. Source-override results measure the standalone native benchmark path, including its export/import, rather than the consumer package exporter or a live editor.

```bash
cd "$ENGINE"
taskset -c 12-19 nice -n 10 timeout --kill-after=5 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
taskset -c 12-19 nice -n 10 timeout --kill-after=5 4800 python3 "$ASSET/dense-native.py" /home/hyper/bench/wt/fp-perf/benchmarks/autorouter "$RUN/original" "$RUN/candidate" /home/hyper/bench/boards/dense/fab_pcb-case-dense6-bga324-j1 "$RUN/dense"
for CASE in l2 l3-cycle18; do
  for MODE in original candidate; do
    taskset -c 12-19 nice -n 10 timeout --kill-after=5 900 bun "$ASSET/stress.ts" "$RUN/$MODE" "/home/hyper/bench/boards/ladder/$CASE.dsn" "$RUN/$CASE-$MODE"
  done
done
taskset -c 12-19 nice -n 10 timeout --kill-after=5 5400 bun "$ENGINE/docs/pr-assets/agent-fab-router-perf-local-rescue/point-components/slow.ts" "$RUN/candidate" "$RUN/slow.json"
python3 "$ASSET/verify.py"
python3 "$ASSET/verify-dense.py"
```

The enabled slow driver evaluates all unchanged slow-tier expectations and records existing failures; its zero exit means the sweep completed, not that every acceptance case passed. The standard acceptance CLI returns one for the retained failures. Dense and ladder runs use exactly two passes and 600-second route budgets; ladder counters are not native DRC scores. `profile.py`, `replay.ts`, `probe.py`, `stress.py` and raw supervisor logs retain the original diagnostic commands and ordering.

## Archive

Lossless archives retain all 156 native attempts' sessions, exported inputs, effective settings, manifests, reports, native checks and runner records, plus the full control/result/summary files. They omit reconstructed native output boards; the frozen input checkout and native runtime are required for a fresh checker execution. Native comparison replay rejects four deliberate evidence corruptions. Dense replay rejects two, and the twelve replay records independently verify actual counterbalanced chronology and derived timings. Manifests protect all archived payloads; immutable Git revisions verify implementation/spec/test/tool/package/config hashes. No findings, failed attempts or adverse cases are excluded.
