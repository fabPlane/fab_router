# Rim containment measurements

The candidate walks existing convex parts, rings and core points directly in `withinRim`.
It removes the filtered-cutout, flattened-parts and sliced-probes arrays. The same
containment predicates, probe order, boundary rules and degenerate-ring rules apply.
The differential test compares 42,048 decisions against the original traversal.

Measurements use `hyper-ms-lin`, CPUs 12–19, Bun 1.4.0, and native KiCad 10.0.6 checks.
`measurements.json` retains every attempt, including failures, with vias, length,
opens, native errors and SES SHA-256 fingerprints. `tables.md` includes every case.
Medians and nearest-rank p95 values use all three attempts, including failed boards;
with only three samples, p95 is the maximum and is a noisy tail estimate.
The single-router runs cover all 26 cases but are not a five-router ranking.

The initial sequential full runs took 422.733 seconds before and 466.534 seconds
after (+10.4%). The captured one-minute host load was 2.26 before baseline and
9.01 before candidate. This unfavorable result is retained. An additional native
experiment alternates baseline/candidate order by case, with three repeats of each
version per case. This reduces long-term load drift; it does not isolate the shared
host or establish a general runtime guarantee.

The initial candidate command started before its code commit was created. Every
captured source-file hash was checked against `53a5594`; every baseline hash was
checked against `69cf598`. Original controls, including the recorded parent commit,
remain in `measurements.json` for provenance.

Bun CPU profiling on three direct calls with the slow pour board and native settings
recorded 46,663 samples: `withinRim` self 2,417 (5.18%), array filtering 1,020 (2.19%),
`pointInRing` 6,727 (14.42%), and `onSeg` 9,150 (19.61%). The change addresses traversal
allocation, while keeping the underlying predicates unchanged.

The alternating direct-route experiment is also retained: the smaller slow board's
median was 20.457 → 17.619 seconds, while the larger slow board's median was
58.349 → 59.857 seconds. All direct-route SES hashes match. These mixed results
reinforce the timing uncertainty.

Ladder results use frozen local copies of levels 1 and 2. The first 120-second-capped
experiment completed level 1 and left 27 incomplete connections on level 2, with
zero added router violations. One candidate level-2 repeat reached seven passes
rather than six and emitted different SES bytes at the cutoff. A second experiment
uses two fixed passes and a generous budget: all three repeats per version emit
identical SES hashes on both levels, with no timeouts. Level 2 retains 29 incomplete
connections and zero added router violations. Its median was 22.728 → 22.120 seconds.
Ladder counters are router checks, not independent native DRC acceptance.

Reproduce from the candidate checkout, with the benchmark runtime already installed:

```bash
bun install --frozen-lockfile
bun run typecheck && bun run check:layers && bun run test

taskset -c 12-19 nice -n 10 python3 \
  docs/pr-assets/agent-fab-router-perf/paired-native.py \
  --benchmark-checkout /home/hyper/bench/wt/fp-perf \
  --baseline-source /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout \
  --candidate-source /home/hyper/bench/wt/fr-perf \
  --out /tmp/rim-native-reproduction

taskset -c 12-19 nice -n 10 bun run acceptance -- --tier slow \
  --report /tmp/rim-acceptance.json

taskset -c 12-19 nice -n 10 bun --cpu-prof \
  --cpu-prof-dir /tmp \
  docs/pr-assets/agent-fab-router-perf/profile-route.ts \
  /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout \
  /home/hyper/bench/agents/codex-fabpcb-perf/scratch/before-01/runs/run-20261018T142523.090101Z-003/fab-router/work \
  3
```

`paired-native.py` calls the frozen harness without changing cases, settings or checks.
It retains per-case reports and can resume completed case directories. `plot.py`
regenerates the PNG from committed measurements with matplotlib.

The completed interleaved run took 427.201 → 397.386 seconds in total. The sum of
per-case medians was 142.335 → 131.700 seconds (7.5% lower, 1.081×). Both versions
passed 39/78 attempts and 13/26 cases at 3/3, with 120 opens and 27 new native errors
across attempts. These native failures already occur in the baseline; the candidate
adds none relative to it. All 78 paired SES files, outcomes, vias and lengths match.

Slow acceptance completed all 63 cases on both versions: 51 pass, the same 12 fail,
14 advisory, zero stubbed. No candidate case has more incomplete connections, and
no router violations are added. The original 30-minute outer supervisors were
extended while individual case budgets remained enforced; they returned 124 when
resumed after the complete JSON reports had been written. The committed per-case
reports, rather than that supervisor status, establish the completed outcomes.
Typecheck, layer checks and all 860 candidate unit tests pass; baseline has 859.


## Cycle 2 repeat

A fresh full interleaved experiment on the same host, core set, 26 cases and three
repeats per version used baseline `69cf598` and candidate `b03002e` (identical
production source to `53a5594`). All 78 paired SES hashes, pass/fail outcomes,
opens, error types/counts, fidelity failures, vias and lengths match. Both versions
again pass 39/78 attempts and 13/26 cases at 3/3, with 120 opens and 27 new native
errors across attempts. These existing failures remain unresolved.

Total route-path time: 400.361 → 364.849 seconds. Sum of case medians:
132.908 → 120.898 seconds (9.0% lower). Individual cases regress. This repeat
supports the favorable first interleaved result, but neither experiment isolates
the shared host; concurrent work on other cores was observed, and this cycle's
unit tests overlapped the early native cases. The adverse initial sequential run
remains relevant. No universal speedup or DRC-clean suite is claimed.

`cycle2-measurements.json` preserves every attempt and each case/version's source
identity; `cycle2-tables.md` has per-case median and nearest-rank p95 (maximum of
three). The analyzer checks complete case reports, all seeds, matching benchmark
identity, recorded source hashes against their Git commits, and paired SES/quality
invariance before writing a report. It was also checked against the first complete
interleaved run and reproduced its recorded totals. Typecheck, layer checks and
all 860 unit tests passed again; slow acceptance and ladder results above are from
cycle 1, with unchanged production source.

Reproduce the repeat using the `paired-native.py` command above with a fresh output
directory, then verify and render it:

```bash
taskset -c 12-19 nice -n 10 timeout 120 python3 \
  docs/pr-assets/agent-fab-router-perf/summarize-paired.py \
  /tmp/rim-native-reproduction --out docs/pr-assets/agent-fab-router-perf
python3 docs/pr-assets/agent-fab-router-perf/plot-repeat.py
```

The chart requires matplotlib and compares the two interleaved experiments.
