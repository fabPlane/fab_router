# Task S5 — reconcile parse data with the rulings Q-I1-27/28/29

Role: spec-curator. Write set: `spec/acceptance/parse/`, `spec/formats/dsn.md` (F-4 only),
`spec/formats/dsn-dialects.md` (D-11 only), `spec/behaviour/dsn-tokens/quotes.jsonl`,
`spec/acceptance/cases/parse-*.json` (only if a case's expectation must change).

Read `spec/api/contract.md` rulings Q-I1-27, Q-I1-28, Q-I1-29 and `spec/acceptance/parse/README.md`.

1. **Image names as written (Q-I1-27, Q-I1-28).** Regenerate `components[].package` in every
   parse summary as the image name exactly as the board's `component` scope writes it (including
   any `::n` suffix, verbatim non-ASCII). Use an independent extractor (a plain scan of the DSN
   text for `component` scopes is enough — do not use any router), keep every other field, and
   record the change in each touched summary's `notes`. Remove the `components[].package`
   disagreement notes that no longer apply.
2. **Quote rule (Q-I1-29).** Rewrite F-4 and D-11 so that only the declared `string_quote`
   character (default `"`) quotes and the other quote character is an ordinary character;
   regenerate `spec/behaviour/dsn-tokens/quotes.jsonl` to that rule (run the references on the
   snippets; both behave this way). Check that no other clause or vector contradicts it.
3. Run `bun run spec:lint`; commit with the spec-curator trailers; summarise which summaries
   changed and how many cases are expected to flip.
