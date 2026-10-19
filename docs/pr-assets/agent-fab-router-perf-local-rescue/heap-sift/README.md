# Hole-based heap sifting prerequisite (cycle 72)

This standalone experiment extracts the current production SoaHeap class by source boundaries and constructs a candidate pop implementation in memory. No routing code, defaults or rules change.

The candidate saves the last element, selects the smaller child, and moves that child into the hole instead of swapping all four arrays at every level. Both use the original ordered f/h/sequence comparisons. This rearrangement assumes a total order; NaN breaks that assumption. The deterministic exceptional-priority corpus demonstrates a counterexample, so this candidate is parked pending an explicit finite-priority contract or a semantics-preserving fallback. There is no evidence here that production routing supplies NaN, or that any board output changes.

Finite-priority equal-key, mixed push/pop, 20,000-element growth, and pooled clear/reset scenarios compare every pop against both the original implementation and an independent linear-scan reference queue. Object.is checks popped f/h/state and size across the two heaps. The reset corpus clears the reference queue too. The exceptional corpus deliberately includes NaN, infinities and signed zero; its first mismatch is retained in result.json. Source and extracted-class SHA256 identify the implementation under test. The fixed generator and deterministic counts reproduce independently of elapsed timings.

| Scenario | Compared pops | Parity |
| --- | ---: | --- |
| Equal priorities | 13,394 | Yes |
| Mixed operations | 13,276 | Yes |
| Capacity growth | 20,000 | Yes |
| Clear/reset reuse | 6,673 | Yes |
| Exceptional priorities | 16 before mismatch | No |

The six alternating synthetic heap timing pairs in result.json are exploratory microbenchmarks only. They do not establish route speed, full-board invariance, native DRC quality, or a production improvement. They include JIT warmup and are too short for adoption decisions. No router benchmark was run, so no new shared benchmark-history row is appropriate. Historical full native before/after measurements remain in the parent PR description; this experiment does not replace them. Known native thermal errors remain unresolved.

Reproduce from the repository root on the benchmark host:

```sh
taskset -c 12-19 nice -n 10 timeout 60 bun docs/pr-assets/agent-fab-router-perf-local-rescue/heap-sift/verify.ts /tmp/heap-sift-result.json
bun run typecheck && bun run check:layers && bun run test
```

Compare all deterministic result fields except timings; elapsed values naturally vary. An unexpected finite mismatch or missing exceptional counterexample exits nonzero. The production source is read, never modified. Next work should first decide whether to retain the original child-versus-parent comparison sequence with a virtual saved parent, rather than assume transitivity.
