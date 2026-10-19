# Bounded quilt front-cache experiment

The earlier observer found 81.17% simulated coverage with 1,024 slots per quilt. This distinct candidate actually bypasses Map lookups on front hits. Each quilt allocates 1,024 numeric keys and byte states; the original Map remains authoritative on misses and for decided-cell count and invalidation. Every invalidation clears all front states, including empty and partial invalidations. Numeric Map key semantics remain unchanged; NaN keys conservatively miss the front. The measured candidate is captured independently from production. Preparation pins original revision `d62ccee9` so reproduction remains stable after adoption.

Three sequential alternating complete-board pairs use the archived input and enabled recovery settings, cores 12–19, nice 10, individual 300-second timeouts. Allocation is included. All six sessions, settings, final statistics and reports except wall time match the independent archived control. Recovery logs match excluding only nested seconds. Original times are 58.059355 / 55.232355 / 48.727961 seconds; candidate times are 57.929510 / 47.102429 / 47.941250 seconds. Median changes 55.232355 → 47.941250 seconds (−13.20%). Each pair favors the candidate, but shared-host observations do not establish causality or predict suite speed.

A differential stub-clearance trace checks 40,092 queries and 24 invalidations, including negative/fractional coordinates, numeric aliases, collisions, NaN, infinities, large coordinates and partial/full/empty invalidation. It compares decisions, callback counts, decided counts and point coordinates. Three deliberately broken variants (no invalidation, no key check, incorrect blocked result) are rejected. This trace checks cache behavior, not geometric clearance. Source audit covers 1,536 implementation/spec/test files against an independent historical snapshot; only quilt.ts differs. Reversing exactly the candidate substitutions restores the original module hash. Independent preparation reproduces all hashes and candidate bytes. Finite API coverage is not a universal proof.

Both production and candidate pass typecheck, layer checks (71 files, zero violations) and 912 tests / 399,733 assertions, zero failures. Test runs take 351.93 / 350.03 seconds and occur after timing replays. The separate [fresh full native comparison](../quilt-front-native/README.md) decides whether this candidate warrants adoption. Existing native thermal errors are unresolved; matching the archived engine control alone is not a fresh native DRC result.

![Single-board alternating timings](chart.png)

Exact reproduction, repository root, unused work directory:

```sh
p=docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-front
s=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/quilt-front-repro
mkdir -p "$s"
python3 "$p/prepare.py" "$s/work"
taskset -c 12-19 nice -n 10 timeout 30 bun "$p/controls.ts" "$s/work/original" "$s/work/source"
python3 "$p/mutation.py" "$s"
python3 "$p/run.py" "$s"
PYTHONDONTWRITEBYTECODE=1 python3 "$p/report.py" "$s" "$p"
rsvg-convert -w 1600 "$p/chart.svg" -o "$p/chart.png"
for mode in original candidate; do
  python3 "$p/native-run.py" "$s/work" "$HOME/bench/wt/fp-perf" "$mode"
done
n=docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-front-native
PYTHONDONTWRITEBYTECODE=1 python3 "$n/collect.py" "$s"
```

Archived evidence can be checked without routing:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-front/verify.py
```

The PNG was visually inspected. Bounded capacity per quilt does not establish a bound on simultaneously live quilts or net memory savings. Earlier lattice cache/key experiments target a different module and remain separate.
