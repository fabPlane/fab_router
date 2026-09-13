# Similarity review — M2-I1 (I1 DSN reader merge, orchestrator)

Gate: `bun run similarity -- --milestone M2-I1`.

| Finding | Our side | Disposition |
|---|---|---|
| RUN `src/dsn/read.ts` 64 tokens (23 distinct, 12 structural) | a `for` loop collecting numeric lexemes into a coordinate list with a parity check | matched a Java file of a different subsystem; generic loop shape, not copying |
| RUN `src/dsn/lex.ts` 63 tokens (19 distinct, 9 structural) | a function prologue initialising counters (BOM check, line, lineStart) | matched a Java arithmetic helper; generic prologue, not copying |
| RUN `src/dsn/index.ts` 42 tokens | `export { … } from` list | boilerplate |
| IDENT `readViaRule` | the obvious name for a function reading a `via_rule` scope | un-banned as generic |
| RUN `src/geom/predicates.ts`, `test/acceptance-tools.test.ts` | unchanged | reviewed M2-I0 |

Verdict for I1: **no copying indicated**. Cross-language (TypeScript vs Java) run matches on plain
loops and prologues are expected from identifier normalisation; the review reads the candidate
text for each.
