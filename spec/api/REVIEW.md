# Review of the API contract against the acceptance cases (S4)

Scope: `spec/api/contract.md`, `spec/api/settings.md`, `spec/types/*.ts` and
`spec/acceptance/README.md` / `schema/case.schema.json`, checked against every field the cases
under `spec/acceptance/cases/` reference (settings-*, rules-*, ses-roundtrip-*, and the routing,
parse and DRC cases written by S2/S3) and against the outcome-only scenarios under
`spec/behaviour/scenarios/`. Each entry states the gap, the observation behind it, and proposed
clause text. Numbering `RV-nn` is for citation only; the orchestrator applies the review.

## A. Fields the cases reference that the contract lacks

**RV-01 — per-Sheet along-direction cost.** Settings cases expect `layers/<Sheet>/alongCost`
(the file's `preferred_direction_trace_costs`) next to `againstCost`. `SheetOverride` has only
`active`, `preferDir`, `againstCost`, and `settings.md` describes `preferredDirectionCost` as a
single global multiplier. Both DSN and rules files carry an absolute cost pair per Sheet
(e.g. F.Cu 100.0 / 102.6 on one corpus file, which also scales that Sheet against the other).
Proposed: extend `SheetOverride` with `alongCost?: number` and define, in `settings.md`:
"The cost of one LU of a leg on a Sheet is `alongCost` when the leg runs parallel to the Sheet's
preferred direction and `againstCost` otherwise. Defaults: `alongCost` 1, `againstCost` =
`preferredDirectionCost` (1.5). A Sheet with no preferred direction uses `alongCost` for every
leg."

**RV-02 — how `report.effectiveSettings` is addressed by a case.** The `settings` kind says
"fields of `report.effectiveSettings`" but Sheet names contain dots (`F.Cu`), so a dotted path is
ambiguous. The cases use slash-separated paths: `layers/F.Cu/active`, `layers/F.Cu/preferDir`,
`layers/F.Cu/alongCost`, `layers/F.Cu/againstCost`; every other metric is a top-level field name
(`viaCost`, `planeViaCost`, `startRipupCost`, `viasAllowed`, `optimizerEnabled`,
`fanoutEnabled`, `routerEnabled`, `bendCost`, `preferredDirectionCost`, `layers`). Proposed text
for `acceptance/README.md`: "For kind `settings`, a metric name is a slash-separated path into
`report.effectiveSettings`; `layers` alone compares the whole map (`exact: {}` means no
per-Sheet entry)."

**RV-03 — case setting names versus `RouteSettings` names.** Cases use `router`, `optimizer`,
`fanout`, `timeoutSeconds`, `fanoutMaxPasses`, `fanoutMaxItems`, `optimizerMaxPasses`,
`optimizerMaxItems` (per `case.schema.json`); `RouteSettings` uses `routerEnabled`,
`optimizerEnabled`, `fanoutEnabled`, `timeBudgetMs`, `optimizerPasses`. Only `timeoutSeconds` is
mapped in `settings.md`. Proposed table for `acceptance/README.md`: `router → routerEnabled`,
`optimizer → optimizerEnabled`, `fanout → fanoutEnabled`, `timeoutSeconds × 1000 → timeBudgetMs`,
`optimizerMaxPasses → optimizerPasses`; and add `fanoutMaxPasses`, `fanoutMaxItems`,
`optimizerMaxItems` to `RouteSettings` (currently absent from `types/settings.ts`).

**RV-04 — rules-kind metrics.** The `rules` kind lists "`accepted`, effective values by name"
without naming them. The rules cases use: `accepted` (boolean), `angleMode` (`"90" | "45" |
"any"`, the Layout's angle mode after the file), `defaultWidthUm` (Track width of the NetGroup
named `default`, in µm), `pinEdgeToTurnUm` (the `smd_to_turn_gap` distance, in µm),
`spacingUm:<KindA>:<KindB>` (the SpacingTable value for that unordered Kind pair, pair type
`default`, any Sheet — all corpus values are Sheet-independent; in µm), `groupWidthUm:<NetGroup>`
(that NetGroup's Track width in µm). Proposed: add this list to the `rules` row of the kinds table.
Two of these have no home in `types/layout.ts`:
- `pinEdgeToTurnUm` — the Layout has no field for the SMD pad-edge-to-first-turn distance. Proposed
  `Layout.pinEdgeToTurnLu: number` (0 when the file gives none), with the rule that the router's
  first leg out of an SMD Pad keeps that distance before turning (`spec/rules/`).
- `defaultWidthUm` / `groupWidthUm` — `NetGroup.trackWidth` is optional; the cases need it
  present for every NetGroup after `applyRules`. Proposed: "`trackWidth` is always present; a
  NetGroup without its own `(rule (width …))` inherits the Layout default."

**RV-05 — what `accepted` means for `readRules`/`applyRules`.** `readRules` returns `{ ok, rules,
diagnostics }` and `applyRules` returns the Layout; nothing says when `ok` is false. Observed in
both references: every one of the ten corpus rules files is accepted, including two whose typed
clearance lines are malformed (they produce nonsense Kind names but no error) and three whose
header names a different design than the board. A text that is not a `(rules …)` s-expression is
rejected. Proposed clause: "`readRules` returns `ok: false` only when the text has no `(rules pcb
<name> …)` head. A header name that differs from the Layout's name is a `warning` diagnostic, not a
rejection. `accepted` in a `rules` case is `readRules(...).ok`."

**RV-06 — `ses-roundtrip` expectation and file naming.** The kind row says `treeEquals`; the cases
express it as `"treeEquals": { "equalsFile": "ses/<board file name>.unrouted.sexp.json" }`
(the board file name keeps its `.dsn`, matching S2's `parse/<board file name>.json`). S1 owns
`spec/acceptance/ses/`; confirm the naming or rename the 148 case targets. Also state that
`equalsFile` paths resolve relative to `spec/acceptance/`.

**RV-07 — `report.perNet` should be required.** The `novia` scenarios name nets that must be
complete; a runner can derive this from `checkDrc().incompletes[].net`, but `RouteReport.perNet` is
the natural place and is currently optional. Proposed: make `perNet` required, one entry per net
that has at least one required connection, `incomplete` = number of that net's connections not
realised after `route()`.

## B. Ambiguities and mismatches found while writing the cases

**RV-08 — `planeViaCost` meaning and default.** `settings.md`: "Cost of a Barrel that passes a
plane Sheet", default 100. Observed in both references: the value is the via cost used for *nets
that own a plane* (a Pour of role `plane`) instead of `viaCost`, because dropping into the plane is
the cheapest way to connect such a net; both references default it to 5, and every corpus settings
block sets 5 or 6. Proposed: reword to "Cost of one Barrel on a net that owns a plane Sheet (used
instead of `viaCost` for that net)" and set the default to 5. The settings cases expect the file
values (5 / 6) and, for the no-file cases, the contract default — currently 100; change the four
`*-nofile` / `no-block` cases if the default changes.

**RV-09 — file settings vocabulary.** `settings.md` says a settings block is exposed as
`layout.settingsFromFile` but not which file entries map to which fields. Observed (identical in
both references) and assumed by the settings cases:

| file entry | field |
|---|---|
| `(vias on/off)` | `viasAllowed` |
| `(via_costs n)` | `viaCost` |
| `(plane_via_costs n)` | `planeViaCost` |
| `(start_ripup_costs n)` | `startRipupCost` |
| `(autoroute on/off)` | `routerEnabled` |
| `(postroute on/off)` | `optimizerEnabled` |
| `(fanout on/off)` | ignored by both references (`fanoutEnabled` unchanged) |
| `(start_pass_no n)` | ignored |
| `(layer_rule <Sheet> (active …) (preferred_direction horizontal/vertical) (preferred_direction_trace_costs x) (against_preferred_direction_trace_costs y))` | `layers[<Sheet>] = { active, preferDir: "h"/"v", alongCost: x, againstCost: y }` |
| any other keyword inside the block | ignored (three corpus files carry a mis-spelled router-enable keyword; it is skipped and `routerEnabled` keeps its default) |

Proposed: add this table to `settings.md` (S1's `formats/` should carry the grammar). Ruling
recorded for the `fanout` entry: ignore it, because both references do and a file-driven fanout
pre-pass would otherwise change routing results for boards that merely carry a stale block.

**RV-10 — a `layer_rule` naming an unknown Sheet.** Observed disagreement: reference A discards
the *whole* settings block when a `layer_rule` names a Sheet the Stack does not have; reference B
skips only that rule. No corpus file triggers this. Proposed ruling: skip only that rule and emit
a `warning` diagnostic (reason: every other malformed entry in the block is skipped individually,
and partial application matches how `readDsn` treats recoverable problems).

**RV-11 — rules file that carries a settings block.** Six corpus rules files carry one. The cases
assume: with `useFileSettings: true`, the block from the rules file is applied the same way as a
DSN block and *replaces* the DSN's block when both exist (the one board+rules pair in the corpus
that has both carries identical blocks). Proposed: "`applyRules` sets `layout.settingsFromFile`
to the rules file's block when the file has one; otherwise the DSN's block stays."

**RV-12 — caller precedence with per-Sheet overrides.** `settings.md` gives the order defaults ←
file ← caller. For `layers` the case `settings-fast-issue103-board-routed-caller-wins` assumes a
*field-wise* merge per Sheet (the caller's `layers.B.Cu.active: false` replaces only `active`;
the file's `preferDir`, `alongCost`, `againstCost` for B.Cu survive). Proposed: state that `layers`
merges per Sheet and per field.

**RV-13 — clamping of cost settings.** Reference A clamps `bendCost` to [0, 9.9] and forces
`viaCost`, `planeViaCost`, `startRipupCost` to at least 1; reference B does not clamp. No case
depends on it. Proposed ruling: no clamping; values are used as given (reason: the contract's costs
are dimensionless multipliers and a silent clamp would make `effectiveSettings` disagree with the
caller's input).

**RV-14 — spacing values are rounded to an even number of LU.** Both references round every
spacing value up to an even number of layout units (200.1 µm in a file becomes 200.2 µm at
0.1 µm resolution; 1456.7 becomes 1456.8). The Frame is implementation-chosen, so the rules cases
bracket every `spacingUm:*` expectation as `[file value, file value + 0.2]`. Proposed: either pin
the rule ("a spacing is rounded up to the next even LU count") in `spec/rules/clearance.md` or keep
the bracket; the cases work either way.

**RV-15 — rules-file semantics the cases pin (for S2's `spec/rules/` and S1's `formats/rules.md`).**
Observed identically in both references:
1. An untyped `(clear v)` / `(clearance v)` sets the spacing of *every* Kind pair to `v`, including
   pairs the board had set higher (Breiter/Breiter 500.2 → 200.2 on the Issue107 file).
2. A typed entry `(type A_B)` (bare names, underscore-joined) or `(type "A"-"B")` (quoted names,
   hyphen-joined) sets that unordered pair; a Kind named for the first time is created.
3. `(type smd_to_turn_gap)` (bare or quoted) sets the SMD pad-edge-to-turn distance, not a pair.
4. Within one file the last entry for the same pair wins.
5. A `(class <NetGroup> … (rule (width w)))` scope sets that NetGroup's width and takes precedence
   over the top-level `(rule (width …))` for it (Issue442: top-level 456.7, class `default` 400 →
   400).
6. A `(type smd)` entry with a single bare name has no effect.
7. A single *quoted* name containing an underscore, `(type "kicad_default")`, is split at the
   underscore by both references into a pair `kicad`/`default`, creating a spurious Kind `kicad`.
   This contradicts the SPECCTRA identifier rules (a quoted token is atomic). The cases do not pin
   this; proposed ruling: treat a single-name type as a no-op with a `warning` diagnostic
   (reason: the split is an artefact and produces a Kind no net uses).
8. Pair names written as `bare_"quoted name"` (underscore-joined with a quoted second name — the
   `Issue029-hw48na.rules` / `_invalid.rules` pair) are accepted without error by both references
   but yield nonsense Kinds. The cases only pin the sane values from those files. Proposed ruling:
   accept with a `warning` diagnostic per malformed entry; the entry has no effect.
9. Reference A does not create the NetGroups listed after the malformed entries in those two files,
   reference B does. Unspecified by the cases.

**RV-16 — Kinds and pair types in `SpacingTable.get`.** The contract's `pairType` vocabulary
(`smd_smd`, `smd_via`, …, `default`) and the Kind names in the corpus overlap: `smd` is both a Kind
name in every KiCad export and a component of pair-type names. The rules cases address values
by Kind pair only (`spacingUm:smd:smd` is the Kind `smd` against itself). Proposed: state in
`spec/rules/clearance.md` that a KiCad `(clearance v (type smd_smd))` sets the Kind pair
`smd`/`smd` and that `pairType` in `get()` is a separate dimension that defaults to `default`.

**RV-17 — default preferred direction.** `Sheet.preferDir` may be `null` and `settings.md`
gives no default. Observed in both references: when no file or caller value exists, signal Sheets
alternate, and the first signal Sheet prefers the direction of the board's longer side
(horizontal when the Rim's bounding box is at least as wide as it is tall). Proposed clause
(behavioural, cheap to implement, keeps `preferredDirectionCost` meaningful on boards without a
settings block).

**RV-18 — `fanout.escaped` definition.** `LayoutStats.fanout.escaped` is "how many have a Barrel
escape" but no definition of "escape" exists, and the observed fanout stage of both references
often escapes an SMD Pad with a Track alone (on a two-Sheet board the stub can end on same-net
copper without any Barrel). The fanout scenario therefore uses the definition both references
report: an SMD Pad is escaped when a Track or Barrel of its net touches it without a violation, or
when it lies in a Pour of its net. Proposed: replace "how many have a Barrel escape" in the
`LayoutStats` table with that sentence, and add `fanout.viaEscaped` (touched by a Barrel directly
or through one Track) as a separate, optional count.

**RV-19 — optimiser guarantees.** The contract has no invariant for the optimiser. The scenario
`optimizer-monotonicity.md` requires: after the optimiser, Barrel count and total Track length do
not exceed the pre-optimiser values, no complete connection becomes incomplete, R-1/R-2 still
hold. Proposed as `R-6` in `contract.md`.

**RV-20 — `viasAllowed: false` and pre-existing Barrels.** R-4 says no Barrel is added; the
`novia` scenarios also rely on: Barrels already in the file stay (they are `held`), and a
connection whose two ends lie on different Sheets and has no pre-existing Barrel path is simply
left incomplete. Proposed: add that sentence to R-4.

**RV-21 — `Issue006-…` does not read.** No `ses-roundtrip` case exists for it; the contract should
say `writeSes` is only defined for a Layout obtained from a successful `readDsn`.

**RV-22 — `angleMode` in `effectiveSettings`.** `RouteSettings.angleMode` is optional ("from
file, else 45"); for `report.effectiveSettings` state that it is always resolved (the Layout's
angle mode when the caller passes none).

**RV-23 — reference A's command-line entry point and Barrels (observation for S3/orchestrator).**
Every scenario run of reference A through its command-line interface (this build, single- or
multi-threaded, fanout on or off) produced a session with zero added Barrels on every board of the
scenario list, while S3's reference numbers, produced through a programmatic entry, show Barrels
added on the same boards (e.g. 12 on `Issue026-J2_reference.dsn`). Its fanout stage likewise
reports "+0 extra vias" and escapes Pads with Tracks alone. Consequences: the `novia` scenario is
unaffected (no Barrels by construction, and A's numbers there match a genuine no-via run); the
fanout and optimiser scenarios use A's numbers only where they are conservative (minimum of both
references) and otherwise lean on reference B; nothing in the spec should be derived from A's
command-line Barrel counts. Also observed: A's command-line defaults enable the fanout pre-pass
(the spec's `default` profile disables it explicitly, which S3's harness does).

## C. Type-level nits

- `types/settings.ts`: add `alongCost` to `SheetOverride` (RV-01); add `fanoutMaxPasses?`,
  `fanoutMaxItems?`, `optimizerMaxItems?` (RV-03); `DEFAULT_ROUTE_SETTINGS.planeViaCost` (RV-08).
- `types/results.ts`: `RouteReport.perNet` required (RV-07); `LayoutStats.fanout.escaped`
  definition (RV-18).
- `types/layout.ts`: `Layout.pinEdgeToTurnLu` (RV-04); `NetGroup.trackWidth` required (RV-04).
- `schema/case.schema.json`: `settings.layers` should be `Record<string, SheetOverride>`; `expect`
  metric names for kinds `settings` and `rules` per RV-02/RV-04.
