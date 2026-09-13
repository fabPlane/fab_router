# `src/dsn` — SPECCTRA design files and rules files

Reader and writer for the DSN format of `spec/formats/dsn.md` and the exporter dialects of
`spec/formats/dsn-dialects.md`, padstack name normalisation (`spec/formats/padstack-names.md`),
and the rules-file overlay (`spec/formats/rules.md`). Written from the published SPECCTRA Design
Language Reference (Cadence) and the corpus observations recorded in the spec — nothing else.

| Module | Contents |
|---|---|
| `lex.ts` | lexemes (`open`, `close`, `ident`, `number`, `string`) with source text, quote character, glue and position; only the declared `string_quote` character quotes (F-4, Q-I1-29), switching at its declaration; F-1 decoding of bytes; tested by `spec/behaviour/dsn-tokens` |
| `tree.ts` | lexeme stream → scope tree (F-13 diagnostics), `SExpr` conversion both ways, `type` text reconstruction with adjacency |
| `read.ts` | scope tree → `DsnDocument` (dsn.md §2–§13): sections, shapes, rules, keepouts, planes, placement, images, padstacks, nets with F-101 pin references, classes, wiring; unknown scopes retained in `other`; malformed entries dropped with diagnostics |
| `write.ts` | `DsnDocument` → text with the F-ROUNDTRIP quoting rules; `test/dsn-roundtrip.test.ts` proves the round trip on every corpus board |
| `rules.ts` | `readRules` (F-R1 … F-R3, `type` texts pre-split per F-R12) and `applyRules` (F-R10 … F-R19) on top of `src/layout/rules.ts` |
| `index.ts` | `readDsn` (document + Layout through `src/layout/build.ts`), `parseSummary` for the acceptance runner, re-exports |

The Layout itself is built in `src/layout` (`build.ts`); this module only turns text into the
file-shaped document and back.
