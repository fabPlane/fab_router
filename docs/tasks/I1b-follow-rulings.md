# Task I1b — make the reader follow rulings Q-I1-27…29

Role: implementer. Write set: `src/dsn/`, `src/layout/`, `test/` (reader tests only).

Read `spec/api/contract.md` rulings Q-I1-27, Q-I1-28, Q-I1-29 and the amended clauses:
`spec/formats/dsn.md` F-4 (and F-11, F-20, F-30, F-102, F-ROUNDTRIP), `spec/formats/dsn-dialects.md`
D-11 (and D-4, D-16, D-17, D-S2-05), `spec/formats/rules.md` F-R2, `spec/acceptance/parse/README.md`,
`spec/behaviour/dsn-tokens/README.md`.

1. **Quotes**: only the declared `string_quote` character (default `"`) quotes; any other
   quote-like character is ordinary everywhere. Update the lexer, the writer (F-ROUNDTRIP no
   longer allows falling back to the other quote character) and anything that assumed both
   characters quote. All `dsn-tokens` vectors must pass (the `quotes.jsonl` file was regenerated).
2. **Image names**: `components[].package` in the parse summary is the image name exactly as the
   `component` scope writes it — remove the summary-only merge rule from `src/layout/summary.ts`.
3. Run `bun run acceptance -- --tier all --case 'parse-*'`: all 182 must pass. Update
   `src/QUESTIONS.md` (Status; strike the resolved questions 27–29). Commit with implementer trailers.
