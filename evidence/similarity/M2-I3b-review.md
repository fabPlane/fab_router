# Similarity review — M2-I3b (orchestrator)

Gate: `bun run similarity -- --milestone M2-I3b`. New findings beyond those reviewed in
M2-I0/I1/I3:

| Finding | Our side | Disposition |
|---|---|---|
| RUN `src/layout/summary.ts` 60 tokens (16 distinct, 5 structural) | object literal `{ …, bbox: { x0: u(x0), … } }` followed by an `if` | matched a float-point helper file of a different purpose; literal-shaped, not copying |
| RUN `src/layout/rules.ts` 41 tokens (11 distinct, 5 structural) | `for (const p of L.pads) { if (explicit.has(p.id)) continue; … }` | matched a Java maze-heuristic file; generic loop shape, not copying |
| RUN `src/layout/shapes.ts` 62 tokens (21 distinct, 8 structural) | back-side Pad placement: mirrored Stack index `sheetCount − 1 − sheet` in a `for … of form.perSheet` loop | the spec's own convention (F-113…F-116, Q-I3-17) expressed the obvious way; matched the same float-point helper; not copying |

Verdict for I3b (and the I1 files first flagged here): **no copying indicated**.
