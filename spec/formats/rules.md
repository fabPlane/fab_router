# The rules file

A `.rules` file carries routing rules and settings saved by a router for one design, to be
applied on top of the rules the design file itself declares. It is not part of the published
SPECCTRA language; its scopes reuse the design-file vocabulary (`dsn.md`). Clauses are `F-Rnn`.
The corpus contains ten rules files: `Issue029-hw48na.rules`, `Issue029-hw48na_valid.rules`,
`Issue029-hw48na_invalid.rules`, `Issue107-freq_teiler_200kHz_kicad.rules`,
`Issue107-freq_teiler_200kHz_kicad_bad.rules`, `Issue442-clearance_type_tests.rules`,
`Issue593-BBD_Mars-64.rules`, `Issue191-processor.Z80-processor.rules`, `Issue742-tastexx-pcb-tastexx-pcb.rules`, `Issue269-NoWiresOnPowerLayers-proba.rules` (the last
belongs to a board that is not in the corpus).

## 1. Shape

- **F-R1 Header.** The file is one scope `(rules pcb NAME …)`: head `rules` (any case), the
  literal `pcb` (any case), then the design name as a bare or quoted lexeme. `readRules`
  returns `ok: false` when the text does not start so (`not a rules file` and `(((` are refused,
  never thrown). `NAME` normally repeats the design's `pcb` name or the design file's base name;
  a different `NAME` gives diagnostic `rules-design-mismatch` (warning) and the rules still
  apply (the corpus files name `hw48na`, `freq_teiler_200kHz_kicad`, `Issue593-BBD_Mars-64.dsn`,
  `Issue442-clearance_type_tests`).
- **F-R2 Entries.** Inside `rules`, in any order and any multiplicity: `snap_angle`,
  `autoroute_settings`, `rule`, `layer`, `padstack`, `via`, `via_rule`, `class`. Any other
  scope is skipped with diagnostic `unknown-scope` (info); it stays in `RulesFile.body` and
  `applyRules` ignores it.
  Lexical rules are those of `dsn.md` section 1 (`"` is the quote character — a rules file has
  no `parser` scope — and `'` is an ordinary character, F-4; no comments; `clear` =
  `clearance`).
- **F-R3 Result.** `readRules(text)` returns `{ ok, rules: RulesFile, diagnostics }` where
  `RulesFile = { name, body: SExpr[] }` (the entries in file order as retained scopes, so that
  `applyRules` can walk them) — `spec/types/dsn.ts`.

## 2. Entries and their effect on a Layout

`applyRules(layout, rules)` applies the entries in file order to the given Layout and returns it.
Every value is in the design file's units (`dsn.md` F-41) and converted with the Layout's Frame.
Diagnostics are collected on `layout.warnings`.

- **F-R10 `(snap_angle X)`** — `ninety_degree` / `fortyfive_degree` / `none` sets
  `layout.angleMode` (`90` / `45` / `any`), replacing the design file's.
- **F-R11 `(rule …)`** — `(width w)` sets the default NetGroup's Track width on every Sheet;
  `(clearance c)` sets the default spacing; `(clearance c (type T))` sets the SpacingTable
  entries that `T` names, per `spec/rules/clearance.md`. Each entry replaces the value the
  design file (or an earlier entry) gave. `clear` is an alias of `clearance`.
- **F-R12 `type` syntax** (governs `spec/rules/clearance.md` C-09 as well). The text of a `type` scope is split into *items* at separators and
  at `-` characters that are outside quotes; quotes are removed from each item. The result is
  one or two items. Two items are the pair `(a, b)` — this is how a router writes a pair whose
  members are quoted: `(type "default"-"1A EXTERNAL 1oz")`, `(type "smd"-"smd")`. One item is
  either a *special name* (`smd_to_turn_gap`, `pad_to_turn_gap`, `smd_via_same_net`,
  `via_via_same_net`, `buried_via_gap`, `antipad_gap`), a single Kind or object-type name
  (`smd`, `kicad_default`, `"3,5A EXT HIGH VOLTAGE"`), or a pair joined by `_`
  (`smd_smd`, `default_smd`, `wire_via`). Ruling for one item `X` that is not a special name:
  if `X` equals the name of an existing Kind or one of the object types
  (`spec/rules/clearance.md`), it is `(X, X)`; otherwise, if `X` contains `_`, it is the pair
  split at the *first* `_`; otherwise `(X, X)` creates the Kind `X`. Reference A splits a
  quoted single name at its first `_` (`"kicad_default"` becomes the pair `kicad`,
  `default`) and ignores a bare single name without `_` (`(type smd)`), reference B reproduces
  it; the ruling follows the writer's intent (a router writes `(clearance c (type K))` for the
  diagonal entry of Kind `K`). The glued form `default_"1A EXTERNAL 1oz"`
  (`Issue029-hw48na_invalid.rules`) splits into the two adjacent lexemes `default_` and
  `1A EXTERNAL 1oz`, i.e. the pair `(default_, 1A EXTERNAL 1oz)`; that creates a Kind named
  `default_` and is the reason the file is labelled invalid — the reader accepts it, applies
  it, and the effect is a Kind nobody references (`cases/rules-*.json` pin the accepted
  outcome).
- **F-R13 `(layer L (rule …))`** — the enclosed `width` / `clearance` entries apply to Sheet
  `L` only (unknown `L`: diagnostic `layer-unknown`, entry skipped).
- **F-R14 `(padstack NAME …)`** — defines a PadForm exactly as in a design file (`dsn.md`
  F-95); a definition whose normalised name already exists is skipped (`padstack-names.md`
  P-5) with diagnostic `padstack-duplicate` (info — every corpus rules file repeats the
  design's via padstacks).
- **F-R15 `(via VNAME PADSTACK KIND [attach])`** — defines a named via `VNAME` using PadForm
  `PADSTACK` (resolved per `padstack-names.md`; unresolved → diagnostic `padstack-unknown`,
  entry skipped) with clearance Kind `KIND` (an unknown Kind means the default Kind) and
  `attachAllowed` true when the `attach` token is present, false otherwise. A via with the same
  `VNAME` already defined is replaced. Reference A resolves `PADSTACK` without normalising it
  and therefore drops every via whose padstack name carries decimals (50 of the 66 `via`
  entries in `Issue029-hw48na_valid.rules`); reference B reproduces this. Ruling: resolve like
  every other reference (`padstack-names.md` P-2), so all 66 vias of that file resolve.
- **F-R16 `(via_rule RNAME VNAME…)`** — defines or replaces the via rule `RNAME` as the ordered
  list of the named vias (`spec/rules/vias.md`); unknown `VNAME`s are dropped with diagnostic
  `via-unknown`.
- **F-R17 `(class NAME net… (clearance_class K) (via_rule R) (rule …) (circuit (use_layer L…)
  (use_via P…)) …)`** — creates or replaces NetGroup `NAME` with exactly the listed nets (each
  listed net leaves its previous NetGroup; the class list may be empty, in which case the
  group's membership is unchanged), sets its Kind `K`, via rule `R`, width and clearance from
  `rule`, usable Sheets from `use_layer` and via candidates from `use_via`, per
  `spec/rules/nets.md` / `spec/rules/vias.md`. An empty-string net name is ignored (`dsn.md`
  F-102). `default` names the default NetGroup.
- **F-R18 `(autoroute_settings …)`** — same keys as in a design file (`dsn.md` F-73). The
  values are exposed as `layout.settingsFromFile`, replacing keys the design file set, and are
  *not* applied by `applyRules`; `route()` applies them only with `useFileSettings: true`
  (`spec/api/settings.md`). Reference A ignores this scope in a rules file; reference B reads
  it. Ruling: read it (every corpus rules file carries one, with `(layer_rule F.Cu (active
  off))` in `Issue107-freq_teiler_200kHz_kicad.rules` being the observable case).
- **F-R19 Precedence.** A rules file is applied after the design file has been read and
  before routing; whatever it sets wins over the design file's values, and a later entry wins
  over an earlier one in the same file. Applying the same rules file twice is idempotent: the
  second application changes nothing.
- **F-R20 Accepted / rejected.** The `rules` acceptance cases report `accepted: true` for every
  corpus rules file except when the header is missing (F-R1). `Issue107-…_bad.rules` is
  byte-identical to `Issue107-freq_teiler_200kHz_kicad.rules` and is accepted; its companion
  `_bad.dsn` differs from the plain board only by two extra parts (an image and its
  placements).
  *Amended (Q-I1-30):* a single name without `_` has no effect (diagnostic); a name with `_`
  splits at its first `_`; only `smd_to_turn_gap`, `pad_to_turn_gap`, `buried_via_gap`,
  `antipad_gap` are recognised whole. The "existing Kind → diagonal" rule above is withdrawn.
