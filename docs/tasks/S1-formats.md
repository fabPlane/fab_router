# Task S1 — formats: DSN, SES, rules; lexeme vectors; session expectations

Role: spec-curator. Write set: `spec/formats/`, `spec/behaviour/dsn-tokens/`, `spec/acceptance/ses/`,
`spec/acceptance/cases/parse-*.json` (shared with S2 — coordinate via file prefixes: S1 writes
`parse-lex-*`, `parse-dialect-*`; S2 writes `parse-summary-*`).

## Deliverables

1. `spec/formats/dsn.md` — the DSN file as this router must read it. Written from the published
   SPECCTRA Design Language Reference (cite section numbers). Cover: lexical rules (parens,
   symbols, numbers, quoted strings; the `parser` block's `string_quote` and
   `space_in_quoted_tokens` and *when they take effect*; character encoding), `resolution` and
   `unit` and how coordinates map to physical distance, every scope the corpus uses
   (`structure`: layers with `type`, `boundary`, `keepout`/`via_keepout`/`wire_keepout`, `plane`,
   `rule`, `layer_rule`, `via`, `control`, `autoroute_settings`, `snap_angle`, `grid`, `window`;
   `placement`: `component`/`place` with side and rotation, `flip_style`; `library`: `image`
   with `pin`/`outline`/`keepout`, `padstack` with per-layer `shape` and `attach`; `network`:
   `net`/`pins`, `class` with `rule`/`circuit`/`layer_rule`/`use_via`/`use_layer`, `class_class`,
   `via_rule`, `fromto`/`order`; `wiring`: `wire` with `path`/`polygon`/`type`, `via` with `type`),
   shape grammar (`rect`, `circle`, `polygon`, `path`, `polyline_path`, `qarc`), pin rotation and
   back-side mirroring rules stated as observable pad positions, and what a reader must do with
   unknown scopes (skip with a diagnostic). Number every normative statement `F-nn`.
2. `spec/formats/dsn-dialects.md` — observed exporter dialects in the corpus (KiCad, Eagle,
   Target 3001!, LibrePCB, EasyEDA, others), each as a numbered `D-nn` entry: *observed input* →
   *required interpretation* → *boards where it occurs* (file names from `spec/acceptance/boards/`).
   Include: resolutions and units seen, numbers like `1e-07`, identifiers containing `-` `.` `/`
   `#`, quote characters, files with no `parser` block, files whose paren nesting is broken and
   what must still be recovered, `pcb`-pseudo-layer keepouts, degenerate shapes, duplicate padstack
   definitions, padstack references that need name normalisation (state the normalisation as a
   rule with examples), empty net names, `signal`-pseudo-layer rules.
3. `spec/formats/ses.md` — the session file this router must write and be able to apply back:
   exact section list, coordinate unit (integers in resolution units), which items are written
   (router-added and file wiring, per `includeFileWiring`), `library_out` padstack entries,
   `network_out` wires and vias, identifier quoting (including the empty-identifier case), and
   the acceptance normalisation used by `ses-roundtrip` cases (whitespace-free canonical
   s-expression tree with canonical numbers; ordering as the format prescribes).
4. `spec/formats/rules.md` — the `.rules` file (`rules PCB` scope: `snap_angle`,
   `autoroute_settings`, `rule`/`clearance` with `type` pairs, `padstack`, `class` overrides) and
   its precedence over the DSN's own rules.
5. `spec/formats/padstack-names.md` — padstack reference resolution rules with examples.
6. `spec/behaviour/dsn-tokens/*.jsonl` — lexeme vectors: `{ "input": "<snippet>", "lexemes":
   [{"kind": "open|close|ident|number|string", "text": "..."}], "parser": {"stringQuote": "\"",
   "spaceInQuotedTokens": false}, "note": "..." }`, one file per theme (quotes, numbers,
   identifiers, encoding). Produce expected lexemes by *running* the references on the snippet
   and recording what they produced; where they disagree, rule and note it.
7. `spec/acceptance/ses/<board>.unrouted.sexp.json` — for every board that reads successfully:
   the canonical tree of the session a reference writes for the *unrouted* board (file wiring
   only). Header field `_generated`.
8. `spec/acceptance/cases/parse-lex-*.json` and `parse-dialect-*.json` — cases that pin the
   dialect entries (kind `parse`, `expect.status` and counts).

## Rules of writing
Behaviour only; no names of reference classes, files, functions, or tokens. Cite the published
reference for public facts. Every quirk must name at least one corpus board that exhibits it.
Run `bun run spec:lint` before you finish; it must be clean. Commit with the spec-curator trailers.
