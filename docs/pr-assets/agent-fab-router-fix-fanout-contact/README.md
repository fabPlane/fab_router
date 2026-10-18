# Verify SMD fanout contact

A pad anchor can lie outside its copper. Previously fanout accepted a clear via at that
anchor (or a clear stub from it), marked the pad done and left disconnected router copper.
The fix computes live connectivity after inserting the trial and rewinds the complete trial
unless the new via shares the pad's connected component. Exact clearance remains unchanged.
This is false-success prevention, not an extended search for off-anchor copper.

The identical six-test synthetic suite runs three times per version on the same host,
cores 20–25: main 69cf598 passes 2/6, candidate passes 6/6 each repeat. Positive controls
cover centred and partially overlapping pad copper. Negative tests cover positive/negative
offsets and atomic rewind with/without a generated stub, including live lattice joins,
retained pad/fence records and zero engine violations.

```sh
python3 docs/pr-assets/agent-fab-router-fix-fanout-contact/regression.py --out /tmp/fanout-contact-regressions
python3 docs/pr-assets/agent-fab-router-fix-fanout-contact/render.py
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
cd ../fp-bugs
taskset -c 20-25 nice -n 10 timeout 3000 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source ../fr-bugs --out /tmp/fanout-contact-native
```

The additional connectivity computation has a potential cost on fanout-enabled boards;
shared-host native timings cannot establish a speed change. Native thermal starvation and
other remaining opens are outside this fix. Preserve the independent fanout budget and
spanning-destination fixes during integration.
