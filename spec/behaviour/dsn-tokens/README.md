# DSN lexeme vectors

One JSONL file per theme (`quotes`, `numbers`, `identifiers`, `encoding`). The first line of
each file is a header with `_generated` and `_format`; every other line is a record:

```json
{ "input": "<snippet>",
  "lexemes": [ { "kind": "open|close|ident|number|string", "text": "...", "glued": true } ],
  "parser": { "stringQuote": "\"", "spaceInQuotedTokens": true },
  "note": "..." }
```

`lexemes` is the exact sequence the lexer of `spec/formats/dsn.md` section 1 must produce for
`input`: `text` is the lexeme's source text (for a `string`, the text between the quotes).
`glued` is present (and `true`) only on a lexeme that follows the previous lexeme with no
separator in between, where neither is a parenthesis (`dsn.md` F-9); it is how a reader tells
`"J1"-"D+"` (one pin reference) from `"J1" -"D+"` (two entries). `parser` is the parser scope in
effect; it never changes how a snippet lexes (F-4, F-11) and is carried for completeness.

`note` explains the snippet and records, where it applies, that a reference implementation
tokenises the snippet differently (with its token texts) — those differences are the rulings of
`dsn.md` section 1 and `dsn-dialects.md`, not errors in the vectors.
