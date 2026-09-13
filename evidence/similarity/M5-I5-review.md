# Similarity review — M5-I5 (orchestrator)

Gate `bun run similarity -- --milestone M5-I5`.

| Finding | Disposition |
|---|---|
| IDENT: a result-type export in src/route/fanout.ts | Exact collision with a reference class name (harvested). Generic in form, but the gate keeps the output free of shared distinctive identifiers — **renamed to FanoutOutcome by I6b** rather than admitted. |
| RUN src/route/legalise.ts 48 tokens (20 distinct, 10 structural) | Generic accumulator prologue matching an unrelated file; reviewed at M4-I4. Not copying. |
| CONST / other | Trivial constants and previously-reviewed generic runs. |

A*, layered via search, PathFinder rip-up (resource-cell history), fanout, nudge and the monotone
optimiser are designed from the cited literature. No reference control structure appears. Verdict:
**no copying indicated**, pending the fanout result-type rename.
