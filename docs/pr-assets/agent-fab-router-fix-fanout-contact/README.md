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

The frozen native harness disables fanout (`fanoutEnabled:false`); that sweep provides
nonregression coverage, while the six synthetic tests exercise the repaired path.

The additional connectivity computation has a potential cost on fanout-enabled boards;
shared-host native timings cannot establish a speed change. Native thermal starvation and
other remaining opens are outside this fix. Preserve the independent fanout budget and
spanning-destination fixes during integration.

Native comparison: main 69cf598 vs source 9cebc13, 26 identical cases × three repeats,
controls preserved, all 74 captured source hashes verified. Both: 39/78 passing attempts,
13/26 valid cases 3/3, 120 opens, 27 new thermal errors. Every per-attempt pass/open/error,
via count and length is identical. Median route seconds 1.172079 →
1.059487 is descriptive only: shared host and overlapping unit tests;
no speed claim. Captured precommit HEAD is distinguished from verified source identity in JSON.

Required checks pass: typecheck, 65 layer-checked files/zero violations, 865 tests/zero failures,
398482 assertions. See checks.json for file/log hashes and regressions.json for all repeated logs.

## Fanout integration audit

The portable composition audit pins the final budget regression coverage, spanning-destination
fix, and contact guard, then applies the two independent source patches to the contact source.
All versions receive identical test files. On the same host and cores 20–25, three repeats each:

| Source | Targeted passing tests per repeat | Failing tests |
| --- | ---: | ---: |
| Main 69cf598 | 11/19 | 8 |
| Budget fe69341 | 13/19 | 6 |
| Spanning destination 05cb41e | 13/19 | 6 |
| Contact ceeccc8 | 15/19 | 4 |
| All three fixes | 19/19 | 0 |

```sh
python3 docs/pr-assets/agent-fab-router-fix-fanout-contact/composition.py --out /tmp/fanout-composition
```

The audit also runs typecheck, layer checks, and the complete unit suite on the composed
source, including the additional retained-copper and rollback budget tests. See
composition.json for repeated raw logs, source/test identities and full-check evidence;
composition.patch records the exact changes relative to the contact source. This establishes
compatibility on the current synthetic corpus. Other pending fixes are outside the audit;
no composed native score or performance improvement is claimed. Production source on this
branch remains identical to the previously measured contact fix.
