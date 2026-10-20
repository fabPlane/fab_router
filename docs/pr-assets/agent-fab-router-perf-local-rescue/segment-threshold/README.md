# Segment threshold prerequisite

This diagnostic checks a potential short-circuit predicate against the current
`dist2SegSeg` threshold comparison. It does not change any engine code, settings,
clearance, output, consumer pin, or default. No speed improvement is claimed.

The corpus exhaustively enumerates four ordered points on a 3×3 integer grid,
then checks 20,000 deterministic coordinate-domain tuples and their reversed
segments. Nine thresholds include exact distance, adjacent multiplicative values,
zero, infinity and NaN; both strict and touching comparisons are checked.
Two explicit coordinate-boundary tuples and four additional nonfinite/out-of-domain tuples exercise the original-predicate
fallback. This is finite empirical coverage, not a formal proof over all inputs.
For finite documented-domain inputs the squared distances cannot be NaN; comparing
their minimum to a threshold is equivalent to an OR of comparisons. Intersection
must compare zero to the threshold, rather than unconditionally return true.

Result: 838,206 comparisons, zero mismatches. Bins count synthetic outcomes only;
they cannot estimate board hit rates, CPU savings, or allocation effects. Radius
aggregation and production dispatch are outside this isolated segment probe.
Replacing the strict comparison with inclusive comparison fails the corpus.
Removing the fallback also passes this corpus; it is conservative protection,
not evidence of a demonstrated nonfinite incompatibility.

Reproduce from repository root:

```sh
taskset -c 12-19 nice -n 10 timeout 60 bun docs/pr-assets/agent-fab-router-perf-local-rescue/segment-threshold/probe.ts > /tmp/segment-summary.json
cmp /tmp/segment-summary.json docs/pr-assets/agent-fab-router-perf-local-rescue/segment-threshold/summary.json
taskset -c 12-19 nice -n 10 timeout 180 python3 docs/pr-assets/agent-fab-router-perf-local-rescue/segment-threshold/verify.py
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/segment-threshold/chart.py
rsvg-convert -w 1100 docs/pr-assets/agent-fab-router-perf-local-rescue/segment-threshold/chart.svg -o /tmp/segment-chart.png
bun run typecheck && bun run check:layers && bun run test
```

Next prerequisite: observe actual complete-board segment threshold distributions
without changing route decisions; retain input/output equivalence witnesses.
Only then measure an isolated production candidate. Adoption still requires fresh
paired full 26×3 native speed/quality measurements and dense/ladder/slow checks.
Historical native thermal violations remain unresolved; this probe says nothing
about native DRC quality.
