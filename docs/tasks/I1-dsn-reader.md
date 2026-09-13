# Task I1 — DSN reader, document model, Layout builder, DSN writer, rules file

Role: implementer. Write set: `src/dsn/`, `src/layout/`, `src/api.ts` (only the bodies of
`readDsn`, `writeDsn`, `readRules`, `applyRules`), `test/`.

Read first: `docs/DESIGN.md` §2–3, `spec/README.md`, `spec/glossary.md`, `spec/api/contract.md`,
`spec/types/{dsn,layout,settings}.ts`, then **all of** `spec/formats/dsn.md`,
`spec/formats/dsn-dialects.md`, `spec/formats/padstack-names.md`, `spec/formats/rules.md`,
`spec/rules/{clearance,nets,vias,keepouts,layers}.md`, `spec/acceptance/parse/README.md`,
`spec/behaviour/dsn-tokens/README.md`. The foundation (I0) has already landed on `main`: use
`src/geom/` for geometry and the runner in `tools/acceptance/` to check your work.

## Deliverables

0. **First**: `bun run typecheck` currently reports one error in `src/api.ts` — the `routeSrj`
   stub lacks the `violationsBefore` / `violationsAdded` fields added by ruling Q-I0-8
   (`spec/api/contract.md`). Fix the stub so the tree is green before anything else. Also
   implement `parseSummary` as a public API function (Q-I0-3) and read the other `Q-I0-*` rulings.

1. **Lexer** (`src/dsn/lex.ts`): the lexical rules of `dsn.md` §1–2, driven by the `parser`
   scope as it is encountered; every record in `spec/behaviour/dsn-tokens/*.jsonl` passes in
   `test/vectors.test.ts` (extend the dispatcher for op `dsn-tokens`).
2. **Tree + document reader** (`src/dsn/read.ts`): text → `SExpr[]` → `DsnDocument` exactly as
   `spec/types/dsn.ts` describes, with the diagnostics of `dsn.md` (codes as listed there),
   tolerant of the broken files the dialects name. Never throws on any corpus board.
3. **Layout builder** (`src/layout/build.ts`): `DsnDocument → Layout` per `spec/types/layout.ts`
   and the rules docs: Frame and LU choice (`docs/DESIGN.md` §1, `dsn.md` unit clauses), Sheets
   with roles and plane nets, PadForms with padstack reference resolution, Parts and Pads with
   rotation and side, Barrels/Tracks/Pours/Fences from `wiring`/`structure`/`library` with the
   right `hold`, Rim, Nets/subnets/NetGroups, the SpacingTable (C-01…C-15 with F-R12 splitting),
   via rules, `settingsFromFile`.
4. **Parse summary** (`src/layout/summary.ts`): produce the normalised summary of
   `spec/acceptance/parse/README.md` from a Layout + document, so `parse` cases with
   `summaryEquals` can compare (the runner deep-compares after sorting as the README states).
5. **DSN writer** (`src/dsn/write.ts`): `DsnDocument → text` satisfying F-ROUNDTRIP on every
   board that reads `ok` or `outline-missing`; add `test/dsn-roundtrip.test.ts` over the whole
   corpus.
6. **Rules file** (`src/dsn/rules.ts`): `readRules` and `applyRules` per `rules.md`.
7. Wire the four API bodies in `src/api.ts`.

## Done when

`bun run typecheck`, `bun run check:layers`, `bun run test` green; every `parse-*` case in
`spec/acceptance/cases/` passes (`bun run acceptance -- --case 'parse-*' --tier all`); every
`dsn-tokens` vector passes; round trip holds on the corpus; `src/QUESTIONS.md` updated
(Status + numbered questions). Commit with implementer trailers. Where a case and the prose
disagree, the case wins (spec precedence) — note it as a question.
