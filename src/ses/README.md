# `src/ses` — session files

The SPECCTRA session writer and reader (`spec/formats/ses.md`; `docs/DESIGN.md` §3), written from
the SPECCTRA Design Language Reference (Cadence 2003) only.

| Module | Contents |
|---|---|
| `write.ts` | `writeSes(layout, opts)`: `session` / `base_design` from the name given to `readDsn` (F-S2); `placement` grouped by image name as written with `(lock_type position)` where the file fixed a Part (F-S32); empty `was_is`; `routes` with the design file's `resolution` (F-S21), `parser` (`host_cad` / `host_version`, F-S31), `library_out` (the structure via list, the classes' `use_via` entries, then every PadForm a written Barrel uses, once each, under the defined name, F-S34) and `network_out` (one `net` per net name owning a written item; Tracks as `path`, wiring Pours as `polygon`, Barrels as `via`; `(type protect)` for Hold `held`; nothing locked, nothing net-less, nothing from a structure plane, F-S40 … F-S45). Numbers are integer resolution units: LU × `perLu`, where `perLu` is 1 unless the Frame coarsened the layout unit (F-S20). Names per F-S30. `attachDocument` / `documentOf` keep the `DsnDocument` on the Layout (non-enumerable) for what the public Layout does not carry — resolution, quote character, parser entries, lock types; without it the Frame's unit stands in and `(parser)` is empty. `ROUTER_ADDED` marks router-inserted items (`origin` property) for `includeFileWiring: false` |
| `normalise.ts` | `normaliseSes(text)`: the canonical tree of F-S50 (numbers outside name positions, `placement` merged and sorted, `parser` reduced to its heads, `library_out` / `network_out` sorted, `path` duplicates and collinear points removed, `polygon` closing vertex dropped, CCW, rotated to its smallest vertex). Agrees with the acceptance runner's own canonicaliser on every corpus board |
| `apply.ts` | `applySes(layout, text)`: `routes` / `network_out` only (F-S60); every free or held Track, Barrel and Pour removed first, locked ones kept (F-S61); nets by exact name, Sheets by exact name (`Top` / `Bottom` standing for the outer Sheets when no Sheet has that name, for sessions written by other tools), PadForms by the normalised name of `padstack-names.md`; `path` / `polyline_path` → held Tracks, `polygon` (+ `window`) → held Pours, `via` → held Barrels; `type` ignored; coordinates in the session's own `routes` resolution (F-S62); Kinds from the net's NetGroup categories (F-S63); one diagnostic per skipped entry |

Two departures from the letter of `ses.md`, both forced by the acceptance data and recorded in
`src/QUESTIONS.md`: wiring Pours are written without `window` scopes (every expected tree omits
them), and `Top` / `Bottom` are accepted as Sheet aliases when applying.

Tests: `test/ses.test.ts` (writer clauses on hand-built names and on boards of three unit
systems, `normaliseSes` against the runner's canonicaliser and as the identity on every expected
tree, `applySes` diagnostics / units / replacement, and the contract's round trip — `writeSes` →
`applySes` on a fresh `readDsn` reproduces item counts and DRC statistics on every readable corpus
board), `test/applied-ses.test.ts`, the `ses-roundtrip` and `ses-apply` acceptance cases.
