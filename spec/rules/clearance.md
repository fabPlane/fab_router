# Clearance: Kinds and the SpacingTable

Vocabulary: `spec/glossary.md`. Clauses are numbered `C-nn`. Everything below is stated as what
`readDsn` / `applyRules` must produce (observable through `Layout.spacing`, the parse summaries
in `spec/acceptance/parse/`, and `checkDrc`), never as a procedure. File syntax is in
`spec/formats/dsn.md` and `spec/formats/rules.md`; this file gives the semantics.

## Kinds

**C-01 — the two built-in Kinds.** Every Layout has Kind index 0 named `null` and Kind index 1
named `default`. Kind `null` is "no clearance": an item carrying it is never part of a spacing
violation and never pushes copper away (used for the board-covering Pours of power Sheets, and for
Fences whose named class does not exist). Kind `default` is what every item carries unless a rule
says otherwise. `Layout.spacing.kinds` lists Kinds in creation order; the parse summary's
`rules.kinds` is that list.

**C-02 — Kind names are case-insensitive** for lookup (a rule naming `Default` finds `default`)
but are stored and reported with the spelling of their first mention.

**C-03 — how Kinds come into being.** In this order, for a DSN file:

1. `null`, `default`.
2. Structure `rule` scopes with a `(type a_b)` clearance: each half `a`, `b` of the pair that is
   not `wire` and not yet a Kind becomes one (`wire` means Kind `default`). A pair type starting
   `wire_` or ending `_wire` additionally creates the four category Kinds `via`, `smd`, `pin`,
   `area` (in that order) if absent.
3. `class` scopes carrying a `rule` with a `clearance` (with or without pair types): the class's
   name becomes a Kind (C-08). Pair types inside a class rule create Kinds named
   `<class>-<half>` for each half that is not `wire` (C-09).
4. `class_class` scopes: no new Kinds; they set values between class Kinds (C-10).
5. A `.rules` file applied afterwards creates Kinds the same way (C-13).

Names created by `smd_to_turn_gap` are never Kinds (C-12).

## Values

**C-04 — unit rounding (LU).** The layout unit is 1/`resolution.perUnit` of the file unit,
coarsened by a factor of ten while the largest absolute outline coordinate in LU is ≥ 2^25 / 5
(only `Issue676-ch32v-tx118s.dsn`, `(resolution mm 1000000)`, coarsens: LU = 10 nm there).
Every spacing value in a file is converted to LU by rounding to the nearest integer, then
**rounded up to the next even integer** if odd. Every width is converted by halving, rounding the
half-width to the nearest integer LU, and doubling. Consequences an implementer must reproduce
(`resolution um 10` unless stated):

| File says | LU | Reported in file units |
|---|---|---|
| `(clearance 200.1)` | 2001 → 2002 | 200.2 |
| `(clearance 200)` | 2000 | 200 |
| `(clearance 152.5)` | 1525 → 1526 | 152.6 |
| `(clearance 38.1)` | 381 → 382 | 38.2 |
| `(clearance 1016.1)` | 10161 → 10162 | 1016.2 |
| `(clearance 57.15)` | 571.5 → 572 | 57.2 |
| `(width 304.8)` | half 1524 | 304.8 |
| `(width 250)` | half 1250 | 250 |
| `(width 152.4)` | half 762 | 152.4 |
| `(clearance 5)` in a `resolution mil 1000` file | 5000 | 5 |

The parse summaries report every spacing and width after this rounding, in file units
(`spec/acceptance/parse/README.md`). A negative clearance is clamped to 0.

**C-05 — the table is symmetric and per Sheet.** `spacing.get(a, b, sheet)` equals
`spacing.get(b, a, sheet)` for every Sheet. A `rule` at structure level sets a value on every
Sheet; a `layer_rule <name> (rule …)` sets it on that Sheet only. `rules.layerDependent` in a
parse summary lists the pairs whose values differ between Sheets (none in the corpus).

**C-06 — the default value.** A structure `(rule (clearance N))` with no `type` sets the value of
**every pair of Kinds with index ≥ 1 that exists at that moment** to N on every Sheet (a
`layer_rule` version: on its Sheet). Kinds created later start from the values in C-07. The
default value is `spacing.get(default, default)`; the parse summary reports it as
`rules.defaultClearance`. If the file has no clearance rule at all the default value is 0 on
every pair (nothing is ever pushed apart) — `empty_board.dsn` reads this way.

**C-07 — a new Kind copies the default row.** When a Kind K is created, `spacing(K, X)` for
every existing X becomes the current `spacing(default, X)` on each Sheet, and `spacing(K, K)`
becomes `spacing(default, default)`. Rules read afterwards overwrite these values.

**C-08 — a class's own clearance.** `(class X … (rule (clearance N)))` creates Kind `X` (if
absent) and then, for every existing Kind Y with index ≥ 1, sets `spacing(X, Y)` to
**max(the C-07 copy, N)** on every Sheet — a class clearance only ever raises what the default
row gave — and sets `spacing(X, X)` to N exactly (a later `(clearance N (type …))` in the same
class rule may lower individual pairs, C-09). All five item categories of NetGroup X
(`track`, `barrel`, `pin`, `smd`, `area`) then carry Kind X, so every item of a net in X uses
Kind X. Example (`Issue015-StackOverflow.dsn`): default clearance 152.5 → 152.6; class
`"1A EXTERNAL 1oz"` with `(clearance 190.6)`: `spacing(default, "1A EXTERNAL 1oz") = 190.6`,
`spacing(smd, "1A EXTERNAL 1oz") = 190.6`, `spacing("1A EXTERNAL 1oz", "1A EXTERNAL 1oz") =
190.6`; class `CUSTOM` with `(clearance 152.5)`: `spacing(default, CUSTOM) = 152.6`. A class rule
with only a `width` creates no Kind.

**C-09 — pair types.** `(clearance N (type T))` names two halves. Outside a class each half is a
Kind name (`wire` = `default`); the rule sets `spacing(a, b)` (= `spacing(b, a)`) to N. Inside a
class X, each half `h` other than `wire` names the Kind `X-h` (created per C-07 from X's row if
absent) and `wire` names Kind X itself; the value is set between the two resolved Kinds. T is
split into its halves by the algorithm of `spec/formats/rules.md` F-R12, which governs both `.rules`
files and DSN `rule` scopes (ruling 2026-09-13, orchestrator: F-R12 recognises the published special
names and the writer's `"a"-"b"` form; the references' first-`_` split is superseded). Consequences:
`smd-smd` and `"default"-"1A EXTERNAL 1oz"` split at the `-`; `default_"1A EXTERNAL 1oz"` splits at
the `_` into `default` and `1A EXTERNAL 1oz`; `default_boundary` (`Issue143-rpi_splitter.dsn`)
creates a Kind `boundary` like any other name; a single name that is an existing Kind or object type
(`(type smd)`) is the diagonal `(X, X)`; a single unknown name without `_` (`(type kicad)` in
`Issue413-test.dsn`) creates the Kind and sets its diagonal — an unused Kind changes no DRC result.
The published special names `smd_via_same_net`, `via_via_same_net`, `buried_via_gap`, `antipad_gap`
are recognised as such, not split (`Issue676-ch32v-tx118s.dsn`); under DR-02 same-net pairs are
exempt, so they are recorded and have no DRC effect. `smd_to_turn_gap` / `pad_to_turn_gap`: C-12.

**C-10 — `class_class`.** `(class_class (classes A B …) (rule (clearance N)) (layer_rule L (rule
(clearance M))))` sets `spacing(A', B')` for every unordered pair of the listed classes,
including a class with itself, where A' is the Kind of class A (its trace Kind — `default` for
the default group). Both classes must already exist; a name that resolves to no NetGroup is
skipped with a diagnostic. `Issue413-test.dsn` and `Issue187-processor.Z80.dsn` carry
`class_class` scopes (values equal to the default, so the table is unchanged).

**C-11 — what each item carries.** The Kind used for an item in `checkDrc` and by the router:

| Item | Kind |
|---|---|
| Pad whose PadForm has copper on exactly one Sheet ("SMD") | its net's NetGroup `smd` category Kind |
| Pad on several Sheets | the group's `pin` Kind |
| Barrel | the via definition's Kind (`(via NAME PADSTACK KIND)`), else the group's `barrel` Kind |
| Track | the group's `track` Kind (the summary's `netGroups[].kind`) |
| Pour, Fence, Rim | the default group's `area` Kind, unless the scope names a class (`(clearance_class K)`), in which case K; an unknown K → `null` for a Fence, `default` for the Rim |
| a `pin` inside `place` with `(clearance_class K)` | K |

The category Kinds start equal to `default` (index 1); they become distinct only when C-03/C-08
create them. The parse summary reports the non-default ones per group as `itemKinds`. A pad
with no net still carries its Kind and still participates in spacing checks.

**C-12 — `smd_to_turn_gap`.** `(clearance N (type smd_to_turn_gap))` is not a spacing: it is
the minimum distance from an SMD Pad's edge to the first bend of a Track leaving it (used by the
router's pad-exit rule; no DRC effect). If absent it equals the smallest default half-width of the
board. The summary reports it as `rules.smdToTurnGap` (e.g. 125 for a 250-wide default, 100 for
a 200-wide default). A file with neither a turn-gap rule nor any width rule (`empty_board.dsn`)
reports 100000 LU (10000 file units at `resolution um 10`): the "smallest half-width" is then
the built-in upper bound, and the default width is the built-in 3000 LU (`rules.defaultWidth`
300 there).

**C-13 — `.rules` files.** `applyRules` applies a rules file's `rule`, `layer <name> (rule …)`,
`class`, `class_class`, `via`, `via_rule`, `padstack` and `snap_angle` scopes to an already-read
Layout with exactly the semantics above (`clear` is a synonym of `clearance`); values it sets
replace the DSN's. A `class` scope in a rules file re-declares the NetGroup: its net list
replaces the group's nets, and its `clearance_class`, `via_rule`, `rule` and `circuit` replace
the corresponding attributes when present; attributes it does not mention are kept. A
`clearance_class` naming an unknown Kind creates it (C-07). Nets that the rules file lists under
a class that does not exist in the Layout are moved into a new group of that name. The file's
`pcb` name need not match the Layout's (`Issue029-hw48na_valid.rules` is applied to
`Issue029-hw48na.dsn` although its classes use spaces where the board uses underscores; the
result is additional Kinds, not an error). `readRules` returns `ok: false` only when the text
does not start with `(rules PCB`.

**C-14 — the largest value.** `spacing.max(k)` is the largest value in row k over every Sheet
and every Kind with index ≥ 1; `spacing.max` over all Kinds bounds how far any item's copper can
influence another. Both are what a query window must be enlarged by (plus the item's own
half-width) to be sure of finding every possible violation.

**C-15 — copper-to-edge and hole clearance settings.** `copperToEdgeClearanceUm` (when set and
≥ 0) gives the Rim a Kind `board_edge` whose spacing to every other Kind is that value converted
to LU (C-04, even rounding included), unless the `boundary` already names a clearance class.
`holeClearanceUm` (when set and > 0) gives every Part-owned circular Fence (how the CAD tool
exports a non-plated hole) a Kind `hole_edge` whose spacing to Kind X is max(the value, the
current `area`-category spacing to X), and sets the drill-to-copper distance used by DR-06
(`spec/rules/drc.md`). Neither is applied by `readDsn` itself; the parse summaries are recorded
without them.
(Ruling Q-I3-21: when the caller sets `copperToEdgeClearanceUm`, that value replaces the
Rim's spacing for every pair, even when the boundary names a clearance class; the exception above
applies only to the file's own default.)

## Reference observations

Both references agree on every value above on every corpus board (the parse summaries'
`rules.spacing` fields were identical between them); the only disagreements found in the rules
area were the via-rule naming and resolution recorded as D-S2-03/04 in
`spec/formats/dsn-dialects.md`.
