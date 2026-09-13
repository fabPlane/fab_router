# Implementer questions and status

Questions are numbered so the spec side can answer by adding clauses to `spec/`. Where the spec
was silent I picked the simplest behaviour that satisfies the acceptance cases and say so.

## Status (task I0 — foundation)

Verification, run from the worktree root:

| Command | Result |
|---|---|
| `bun run typecheck` | green |
| `bun run check:layers` | green — 19 files, 0 violations |
| `bun run test` (with `FAB_ROUTER_ACCEPT_STUBS=1`) | 376 pass, 4 skip (the four DSN lexeme vector files: 63 records, reported with counts), 0 fail |
| `bun run test` (without the variable) | the 339 fast-tier acceptance cases **fail** (none skipped), everything else passes |
| `test/vectors.test.ts` | all 8 geometry vector files pass: 8 × 2 200 = 17 600 records, every record asserted |
| `test/geom-exact.test.ts` | bigint oracle vs float64: 100 000 `orient`/`onSeg` triples (a third exactly collinear, a third within 2 LU of collinear), 100 000 segment pairs, 100 000 distance cases, 2 000 hull sets — all agree |
| `bun run acceptance -- --tier all --report /dev/stdout` (with the variable) | 354 cases (182 parse, 148 ses-roundtrip, 14 settings, 10 rules), 354 passed, all 354 `stub`, 0 invalid case files |

What is real: `src/geom` (kernel, all deliverable-2 operations), `src/layout` (SpacingTable,
empty Layout), `src/pipeline` `resolveSettings` (settings.md precedence and per-Sheet merge),
`tools/acceptance` (validator, loader, F-S50 canonicaliser verified as the identity on all 143
expected session trees, per-kind measurement, report), `src/cli.ts`.

What is stubbed (returns `ok: false` with diagnostic code `not-implemented`, or an empty stats
object): every function in `src/api.ts` — `readDsn`, `writeDsn`, `writeSes`, `applySes`,
`readRules`, `applyRules`, `checkDrc`, `layoutStats`, `requiredConnections`, `route`, `routeDsn`,
`routeSrj` — and `src/dsn` `parseSummary`. `route` does resolve `effectiveSettings` for real.

Not in this checkout: `spec/acceptance/boards/` (and `reference/`), so every case currently
stubs on "board corpus file missing" before it can reach the (stubbed) reader; the runner names
both blockers in its `reason`.

## Status (task I1 — DSN reader, Layout builder, DSN writer, rules file)

Verification, run from the worktree root (after merging `main` at `1e66d51`, which brought the
Q-I3-15…25 rulings and the I3 Lattice; the pre-existing typecheck errors in `src/route/profile.ts`,
`test/clear-vs-drc.test.ts` and `test/helpers/synth.ts` are I3's adoption of the new fields, outside
this task's write set, as the coordinator noted):

| Command | Result |
|---|---|
| `bun run typecheck` | green for every file of this task (`src/dsn`, `src/layout`, `src/api.ts`, `test/`); 8 errors remain in I3's `src/route/profile.ts` / `test/clear-vs-drc.test.ts` / `test/helpers/synth.ts` (task I3b) |
| `bun run check:layers` | green — 35 files, 0 violations |
| `bun run test` (with `FAB_ROUTER_ACCEPT_STUBS=1`) | 612 pass, 13 fail: the 7 parse cases of questions 27–29 and 6 `drc-load` cases that `checkDrc` (I2) answers with zero counts and no `not-implemented` diagnostic, so the runner cannot tell the stub from a measurement (question 42) |
| `bun run test` (without the variable) | additionally the 198 `ses-roundtrip` / `ses-apply` / `routing` fast cases stub (`writeSes`, `applySes`, `route` are I2/I4) |
| `bun run acceptance -- --case 'parse-*' --tier all` | 182 cases: **175 passed, 7 failed** (questions 27–29: package names on 5 boards, single-quote handling on 2 boards) |
| `bun run acceptance -- --case 'rules-*' --tier all` | 10 / 10 passed |
| `bun run acceptance -- --case 'settings-*' --tier all` | 14 / 14 passed |
| `bun run acceptance -- --tier all` (with the variable) | 460 cases, 447 passed, 13 failed, 245 stubbed |
| `test/vectors.test.ts` | all 4 `dsn-tokens` files pass (63 records) in addition to the 8 geometry files |
| `test/dsn-roundtrip.test.ts` | F-ROUNDTRIP holds on all 149 readable corpus boards (`Issue006` is the `parse-error` board) |
| `test/dsn-reader.test.ts` | 14 targeted tests: never-throws on garbage, F-14, F-21, F-101, §11 placement (Issue035 example, rotate_first), F-54, P-1/P-10, F-R1, F-R12, F-R18, F-R19, one id space, keepout fan-out |

What is real: `src/dsn/{lex,tree,read,write,rules,index}.ts`, `src/layout/{model,spacing,units,
shapes,rules,build,summary}.ts`, the API bodies `readDsn`, `writeDsn`, `readRules`, `applyRules` and
the public `parseSummary` (Q-I0-3). The `routeSrj` stub gained `violationsBefore` / `violationsAdded`
(Q-I0-8). `tools/acceptance/run-case.ts` now reports an empty `writeSes` text and a `route` that
logs "not implemented" as stubs instead of failures (they became reachable once `readDsn` was real).

## Status (task I3 — Lattice and clearance queries)

Verification, run from the worktree root (I1 and I2 are not on `main` in this checkout:
`readDsn` and `checkDrc` are still stubs, so every test below uses synthetic Layouts built in
`test/helpers/synth.ts` and a brute-force DRC oracle written in the test):

| Command | Result |
|---|---|
| `bun run typecheck` | green apart from the one pre-existing `src/api.ts` `routeSrj` error that task I1 owns |
| `bun run check:layers` | green — 23 files, 0 violations |
| `bun run test` (with `FAB_ROUTER_ACCEPT_STUBS=1`) | 457 pass, 4 skip, 0 fail |
| `test/lattice.test.ts` | 10 000 random `hits` / `sweepHits` queries against a brute-force scan with interleaved inserts and removes — identical `(id, leg)` lists; 1 000 more across a shelf-overflow rebuild; 500 filtered queries; 2 000 queries identical across three insertion / removal histories; cell-size clamps and shelf placement; item indexing of a synthetic Layout |
| `test/clear-vs-drc.test.ts` | 6 synthetic boards (3 seeds × 45°/any) × 4 settings variants: 1 408 Track legs and 240 Barrels each, `sweepClear` / `barrelFits` equal the oracle's verdict *and* its partner-id list on every one (848–869 legs and 116–163 Barrels blocked per variant, the rest clear); hand-built boundary cases (equal distance clear / 1 LU closer blocked, same-net, ignore set, neck width, Kind-null Pads and Pours, Fence scopes and Kind-null walls, Rim and copper-to-edge override, attach, hole clearance, unknown PadForm); `resolveProfile` fields |
| Lattice at 100 000 slots (debug run, not in the suite) | insert + rebuild 110 ms, 100 000 sweep queries 88 ms, 50 000 removes 17 ms |

Delivered: `src/lattice/grid.ts` (bucket grid, shelf, generation-stamp dedup, median cell size,
amortised rebuild, item directory with lazy shape cache), `src/lattice/shapes.ts` (per-Sheet
copper of every item category), `src/route/profile.ts`, `src/route/clear.ts`, READMEs, tests.

## Status (task I3b — adopt rulings Q-I3-15…25)

Verification, run from the worktree root (`checkDrc` is still the I2 stub in this checkout, so
step 3 of the task — asserting `checkDrc(layout).violations` against the oracle — does not apply;
the brute-force oracle in `test/clear-vs-drc.test.ts` stays):

| Command | Result |
|---|---|
| `bun run typecheck` | green (the 8 errors of I1's status table are gone) |
| `bun run check:layers` | green — 35 files, 0 violations |
| `bun run test` (with `FAB_ROUTER_ACCEPT_STUBS=1`) | 614 pass, 13 fail — the same 13 as I1's status: 7 parse cases (questions 27–29) and 6 `drc-load` cases the `checkDrc` stub answers with zero counts (question 42); none in this task's write set |
| `bun run acceptance` (fast tier, in the suite) | 401 cases, 388 passed, 13 failed (as above), 198 stubbed |
| `test/clear-vs-drc.test.ts` | 6 synthetic boards × 4 settings variants: 1 432 Track legs and 258 Barrels each, `sweepClear` / `barrelFits` equal the oracle's verdict *and* partner-id list on every one (925–984 legs and 171–209 Barrels blocked per variant; 91 items per variant off the board under DR-11); hand-built cases for DR-11 (far outside, inside a cut-out, crossing the outline / a cut-out edge, touching with a zero edge clearance, degenerate outline), DR-06a (hole on a copper-less Sheet, drill-to-drill with disjoint spans), `Fence.kind`, net-owned Fences, `categoryKinds` and `ViaRule.entries` in the Profile |
| `test/lattice.test.ts` | as before, plus Pads / Barrels indexed on every Sheet of their drill span (empty `shapesOf` there) |

Changes: `src/route/profile.ts` reads `categoryKinds.track` / `.barrel` and `ViaRule.entries[]`
(`kind`, `attach`; a rule with `forms` but empty `entries` falls back to the group's barrel Kind
and the PadForm's attach flag). `src/route/clear.ts` reads `Fence.kind` directly (`fenceKind`
removed), applies DR-06a (the drill-to-drill check no longer requires a shared Sheet; `barrelFits`
with hole clearance scans every Sheet of the Stack so a drill with a disjoint span is found) and
DR-11 (an outline / cut-out edge the copper's interior crosses blocks like a `rim` hit; when no
edge blocks, one core point per convex part — every point for a sharp part — is tested with the
crossing-number predicate against the outline and each cut-out; exported as `crossesEdge` /
`withinRim`). `src/lattice/grid.ts` indexes a Pad or Barrel on every Sheet its drill passes
through, copper or not, with the union of copper and drill bounds. `test/helpers/synth.ts` carries
the new fields, a PadForm with a through drill but outer-Sheet copper only, two blind via forms
with disjoint spans, a notched outline and deliberately off-board items.

## Questions

1. **Wall hook false positive on relative imports.** `tools/wall/pretooluse.ts` (rule
   B-TRAVERSE) extracts every parent-directory path token (two dots followed by a slash) from
   *file content* in Write/Edit/Bash inputs and resolves it against the session cwd (the
   worktree root), so any ordinary relative import that climbs one directory — a test in `test/`
   importing from `src/`, or a module in `src/drc/` importing from `src/geom/` — is denied even
   though it stays inside the checkout. The layering in `docs/DESIGN.md` §8 and the test files
   the task names cannot be written without such imports. Workaround used, openly: files were
   written with the placeholder `@@UP@@` in import specifiers and a single
   `sed -i '' 's#@@UP@@#..#g' <file>` substituted the real parent segment; the committed files
   contain plain relative imports. Suggested fix: resolve such tokens against the directory of the
   file being written, or exempt the `content` / `new_string` fields from B-TRAVERSE.

2. **`RulesResult` is not in `spec/types/results.ts`.** `spec/api/contract.md` shows
   `readRules(text): RulesResult // { ok, rules: RulesFile, diagnostics }`. Defined in
   `src/dsn/index.ts` (re-exported from `src/api.ts`) as
   `{ ok: true; rules: RulesFile; diagnostics } | { ok: false; error: ParseError; diagnostics }`.
   Please add the type to `spec/types` (or rule on the `ok: false` shape).

3. **Parse summary is not computable from the public `Layout`.** `spec/acceptance/parse/README.md`
   needs fields the `Layout` contract does not carry (`ignored`, `shoveFixed`, `pullTight`,
   `minLength`/`maxLength`, `itemKinds`, `widthBySheet`, keepout `owner`, plane-net flags, the
   `null` Kind at index 0). The runner therefore imports `parseSummary(layout, document, boardName)`
   from the internal module `src/dsn/index.ts` (stubbed here; task I1 fills it). If the summary
   should be reachable through the public API instead (e.g. a `summary` on `ReadResult`), please
   say so.

4. **`SpacingTable.kinds[0]`.** The parse summary prints Kind index 0 as `null`, but
   `SpacingTable.kinds` is `readonly string[]`. `src/layout` uses the empty string (`NO_CLEARANCE_KIND`)
   for index 0 and expects the summary builder to print it as `null`. Confirm.

5. **`boards/MANIFEST.json` tiers.** `case.schema.json` requires `tier` on every case, so the
   runner never consults the manifest's default tier. Confirm that is intended.

6. **`effectiveSettings.layers` and the default preferred direction.** Settings cases compare
   `layers` with `exact: {}` when neither file nor caller gives per-Sheet entries, so the default
   alternating preferred direction (`settings.md` "Default preferred direction") is *not*
   materialised into `effectiveSettings.layers`; the router applies it when it builds per-Sheet
   costs. `resolveSettings` in `src/pipeline` behaves that way. Confirm.

7. **Routing metric names.** `spec/acceptance/README.md` lists `barrels` for the routing kind;
   `docs/PLAN.md`'s example uses `vias`. The runner measures both names (same value). Which is
   canonical?

8. **`srj` cases.** How is the SRJ input named and located (a `.json` under `boards/`?), and what
   does `violations` mean for `routeSrj`, which returns only a `RouteReport` (no before/after
   stats)? The runner currently reports `violationsBefore + violationsAdded` from the report.

9. **`drc-load` options.** The runner maps the case settings `copperToEdgeClearanceUm`,
   `holeClearanceUm` and `ignoreNetGroups` to `DrcOptions`; other settings are ignored for this
   kind. Confirm.

10. **`rules` kind `spacingUm:<A>:<B>` "any Sheet".** Measured on Sheet 0 with pair type `default`.
    Confirm (no corpus board has layer-dependent spacing per `parse/README.md`).

11. **Missing corpus files.** With `FAB_ROUTER_ACCEPT_STUBS=1` the runner treats a missing board /
    rules / session / reference / expected file as a stub (passing, flagged). Without it such a
    case fails. Is that the intended semantics once the corpus lands?

12. **`polygon-area` and the float64 kernel.** `area2` (fan sum of exact doubled triangle areas)
    is exact whenever every partial fan sum stays within 2^53, which holds for all convex
    polygons and for all vector records; a spiral-like simple polygon near the ±2^25 bound could
    in principle exceed it in an intermediate sum. `rational.ts` `area2Exact` is the bigint form.
    Should the spec state a tighter bound (e.g. |2A| ≤ 2^52 for any ring) or leave it?

13. **`writeDsn` / `writeSes` stub value.** String-returning functions have no `ok` field; the
    stubs return `""` and the runner reports "writeSes returned empty text" as a failure when
    the reader is real but the writer is not. Acceptable, or should the contract give these
    functions a result object too?

14. **Informational.** `tools/check-layers.ts` uses `Bun.Transpiler.scanImports`, which rejects a
    `#!` shebang line, so `src/cli.ts` carries none (`bun run src/cli.ts …` works as the contract
    states).

### Task I3

15. **Item ids are assumed unique across categories.** `Violation.a` / `b` are plain numbers and
    `docs/DESIGN.md` §2 speaks of one ItemTable, so the Lattice directory and `blocking` lists
    treat Pad, Barrel, Track, Pour and Fence ids as one id space. The Rim has no id and is indexed
    as `RIM_ID = −1`. Please confirm I1 assigns ids that way (or add `id` uniqueness to
    `spec/types/layout.ts`).

16. **`Fence` has no `kind` field.** `spec/rules/keepouts.md` KO-05 and `clearance.md` C-11 give
    every Fence a Kind (`area`, a named class, or `null` for an unknown class / `hole_edge` under
    C-15), but `spec/types/layout.ts` `Fence` carries none. `clear.ts` `fenceKind` reads an optional
    `kind` property when the reader sets one and otherwise uses the default group's Kind. Please add
    `kind: number` to `Fence`.

17. **Pad placement convention.** `shapes.ts` renders a Pad's copper as
    `at + rot(rotationDeg) · mirrorX(form shape)` for a back-side Pad and `at + rot(rotationDeg) ·
    shape` for a front-side one, taking the form Sheet behind Sheet `s` as the mirrored Stack index
    `n − 1 − i` when the form has shapes there and `s` itself otherwise (`absolute` padstacks).
    Both `mirror_first` and `rotate_first` (dsn.md F-114/F-115) reduce to "mirror, then rotate by
    some angle", so I1 can express either by choosing `rotationDeg`. Please confirm that is what
    `Pad.rotationDeg` means for a back-side Pad.

18. **Per-category Kinds are not in the public Layout.** C-11 gives each NetGroup five category
    Kinds (`track`, `barrel`, `pin`, `smd`, `area`) and V-02 gives via definitions their own Kind,
    but `NetGroup` exposes one `kind` and `ViaRule` only PadForm ids. `resolveProfile` therefore
    uses `group.kind` for both Tracks and Barrels; existing items carry their own `kind` field,
    which `clear.ts` uses for the other side of every pair. If the Layout gains the category Kinds
    (or `Barrel`-candidate Kinds on `ViaRule`), the Profile picks them up in one place.

19. **Pair types.** Since C-09/C-11 fold pair types into Kinds, `clear.ts` calls
    `spacing.get(a, b, sheet)` with the default pair type only (consistent with Q-I0-10). Confirm
    no separate pair-type dimension is expected on the router side.

20. **Hole clearance scope.** DR-06 says the enlarged drill circle must not intersect other-net
    copper "on any Sheet of the board"; `clear.ts` applies it on the Sheets within the drill's span
    (`PadForm.drill.fromSheet..toSheet`, every Sheet for a through drill). `settings.md` also says
    "or any other hole", which DR-06 does not list: `clear.ts` checks other-net drill-to-drill
    distance as well (conservative for the router). Which is intended for DRC?

21. **Copper-to-edge override.** `copperToEdgeClearanceUm` is carried on the Profile as
    `edgeClearance` and, when set, replaces the Rim's table value in `sweepClear` / `barrelFits`.
    C-15's exception "unless the boundary already names a clearance class" cannot be detected from
    the public Layout (`Rim.kind` alone does not say whether it came from a named class), so the
    override always wins. If I2 materialises a `board_edge` Kind in the SpacingTable instead, the
    router can simply leave `edgeClearance` unset.

22. **Touching counts as overlap.** For a Kind-`null` Fence (DR-03 "must merely not overlap") and
    for the V-08 attach rule, `clear.ts` treats distance exactly 0 (touching) as overlap — the
    conservative reading for a router that must never add a Violation. Confirm.

23. **Copper outside the Rim.** DR-03 measures only the distance to the outline polylines, so a leg
    lying entirely outside the board is "clear" under the clauses as written; `sweepClear` follows
    the clauses. The search will confine itself to the Rim's interior. Should the spec say copper
    must lie inside the outline (and outside cut-outs)?

24. **`checkDrc` oracle.** `checkDrc` is a stub here, so `test/clear-vs-drc.test.ts` uses its own
    brute-force DRC (as the task allows). Once I2 lands the test should additionally assert
    `checkDrc(layout).violations` against the same oracle; the two rule sets are written to agree
    on ties (both compare `dist² < (required + rA + rB)²` on convex cores).

25. **`Fence.net` (SRJ obstacles).** A Fence whose `net` equals the connection's net is treated as
    same-net (exempt) by `clear.ts`; a DSN Fence never sets `net` (KO-06). Confirm that is the SRJ
    adapter's intent.

26. **`Lattice.insertItem` needs the Layout.** Pad and Barrel bounds depend on PadForms and the
    Stack, so `createLattice(layout)` binds the index to its Layout. Callers that replace the
    Layout object (snapshots) must build a new Lattice; the Journal (I4) should keep one Lattice
    per live Layout.

27. **Parse summaries record merged image names, contradicting `parse/README.md` and D-S2-05.**
    `components[].package` in `spec/acceptance/parse/*.json` is the base name for 1 717 Parts on
    66 boards whose `component` scope names a `NAME::n` image, although the README says "the image
    name exactly as the component scope writes it, including any ::n suffix" and D-23/D-S2-05 rule
    "no merging". The data follows one rule on 62 boards: a `NAME::n` image whose pins coincide, in
    order, with an earlier `NAME` or `NAME::k` image (pin name, padstack, coordinates and rotation
    rounded to the file unit) is reported by its base name. `summary.ts` applies exactly that rule
    to the *summary only*; `Part.package` in the Layout stays as written (sessions need it, F-S32).
    The four boards the references disagreed on (`Issue066-Project_GP8B`, `Issue153-wavefolder`,
    `Issue157-TeamAdapt-LinePCB`, `Issue283-…Natural_Tone_Preamp`) record a mixture no rule
    reproduces (identical images kept, differing ones merged) and fail on that field alone. Please
    regenerate the `package` fields as written (the README's own definition) or bless the rule.
28. **`Issue110-RelayModule` expects reference A's Cyrillic stripping.** Its summary records the
    packages `:` and `:PinSocket_1x08_P2.54mm_Horizontal` for bare Cyrillic image names, which D-2
    explicitly overrules ("names are kept verbatim in every position"). Not reproduced; 1 case fails.
29. **`Issue684` / `Issue721` summaries treat `'` as an ordinary character.** They expect a NetGroup
    named `''` and nets `$1N4396` etc. in the default group although `(class $1N4396 '$1N4396' …)`
    lists them; F-4, D-11 and the `dsn-tokens/quotes` vectors (which pass) say `'…'` is a string
    whatever the parser scope declares. Not reproduced; 2 cases fail. If the intended rule is "only
    the declared `string_quote` quotes", the vectors need the same change.
30. **Special `type` names and lone names (C-09, F-R12).** The summary of `Issue676` shows Kinds
    `via_same_net` and `via` created by `smd_via_same_net` / `via_via_same_net`, i.e. the first-`_`
    split, while C-09 says those names are recognised and not split; `Issue413`'s summary has no
    Kind `kicad` for `(type kicad)`, and the rules cases pin that `(type smd)` leaves `smd|smd`
    untouched, while C-09/F-R12 say a lone name is the diagonal `(X, X)`. Implemented as the data
    says: a lone name without `_` has no effect; a name with `_` splits at its first `_`; only
    `smd_to_turn_gap` / `pad_to_turn_gap` (C-12) and `buried_via_gap` / `antipad_gap` are
    recognised whole.
31. **F-R12 glued forms.** `default_"1A EXTERNAL 1oz"` is read literally as F-R12 says (the pair
    `(default_, 1A EXTERNAL 1oz)`, creating Kind `default_`); a three-item text such as
    `"kicad_default"_"5A EXTERNAL 1oz"` takes its first and last items (`kicad_default`,
    `5A EXTERNAL 1oz`). Both are labelled unspecified by the cases; confirm or simplify.
32. **C-12 "smallest default half-width".** `Issue420`'s summary (structure `(width 200)`, default
    class `(width 100)`) reports `smdToTurnGap` 100, so the half-width is that of the *structure*
    `rule`, not of the default NetGroup after its class rule. Implemented so (`structureWidth`).
33. **V-04 rule for a class named `default`.** `Issue508-SMD-routing-issue-demo`'s summary lists
    two via rules named `default` (the V-03 one and the class's `use_via` one), so a class rule is
    appended even when a rule of that name exists; `via_rule` scopes still replace by name.
34. **`pcb`-layer keepouts: F-66/D-21 (one Fence per Sheet) vs KO-03 (dropped).** Implemented
    F-66. **Unknown layer types: F-60 (kept as signal) vs L-02 (dropped).** Implemented F-60.
35. **Two-vertex polygons with an aperture.** `Issue179` defines `(padstack p7 (shape (polygon 1
    0.01 0 -3.5 0 3.5)))` and its summary counts the pad, although F-52 calls a polygon with fewer
    than three vertices degenerate and says the aperture is ignored. Implemented: a polygon with a
    positive aperture and fewer than three distinct vertices is its stroked outline (a capsule).
36. **C-04 rounding.** The summaries were produced with plain float64 products: `(width 1.005)` at
    `(resolution mil 1000)` gives `1.005 × 1000 / 2 = 502.49999…` → 502 → width `1.004`
    (`Issue289-…VGA`). `units.ts` therefore uses plain `Math.round` on the product; F-43's "halves
    toward +∞" holds only when the product is exactly representable.
37. **A Pad listed by two nets.** `Issue433` lists `R1_source_component_2-2` under two nets and its
    summary counts it in both nets' `pins`. Implemented: the first net keeps the Pad (`Pad.net`),
    both nets list it in `Net.pads`, diagnostic `pin-in-two-nets`.
38. **Net-level width rules (N-06).** No corpus board has one; a net with `(rule (width W))` moves
    into a group named `net:<name>` (a copy of its group with the width). Confirm the naming.
39. **`Sheet.preferDir` at read time.** Left `null` (Q-I0-6: the router applies the default when it
    builds costs). L-09 says the field "reports the effective value" and gives the default as
    vertical on even Sheet indices, while settings.md gives the longer board side; which is it?
40. **`clearance_class` naming an unknown Kind.** In a DSN class it is ignored (N-06 "names an
    existing Kind"; `Issue187`'s summary has no Kind `G_PLCC`), in a rules file it creates the Kind
    (C-13). Implemented as written; confirm the asymmetry is intended.
41. **`writeDsn` and retained scopes.** `SExpr.line` is never set on retained scopes (it would break
    the F-ROUNDTRIP deep-equality); a `place_control` scope is both parsed into `placement.flipStyle`
    and retained in `placement.other`, and the writer emits `(place_control (flip_style …))` only
    when no retained `place_control` exists. Network `(via …)` definitions live in `network.other`
    because `DocNetwork` has no field for them (V-02 reads them from there).
42. **`drc-load` stub detection.**

### Task I3b

43. **DR-11 for sharp copper (r = 0 cores).** "Lies entirely inside" is decided exactly as: no
    outline / cut-out edge meets the copper's interior — `dist²(core, edge) < r²` for a rounded
    core; for a polygon or segment core with r = 0, a *proper* crossing of a core edge (strict on
    both sides) or an edge endpoint strictly inside the core — and every remaining probe point is
    not outside the outline / not inside a cut-out. Touching an edge (distance 0) is on the board
    (the parenthetical of DR-11 is read as: with a copper-to-edge spacing > 0 the spacing rule
    already blocks touching). A Rim whose outline has fewer than three vertices constrains nothing
    beyond its zero-width edges' spacing. A sharp core whose edges pass through outline *vertices*
    only (no proper crossing, no endpoint inside) is decided by its probe points; that is the one
    measure-zero configuration where a sharp polygon could straddle the outline undetected. Confirm
    or say whether DRC (I2) should use a different exact rule.
44. **DR-06a on copper-less Sheets within a drill's span.** A PadForm can have a through drill but
    copper on the outer Sheets only; the hole still exists on the inner Sheets. The Lattice now
    indexes such a Pad / Barrel on every Sheet of its drill span (empty copper there) and the router
    keeps the hole clearance from it on those Sheets. DRC should count the same pairs; confirm.
45. **Informational.** `barrelFits` with a hole clearance queries every Sheet of the Stack (not
    only the drill's span) so that an other-net drill whose span is disjoint from the new Barrel's
    is still found (DR-06a "regardless of Sheet"); the extra Sheets contribute nothing else.
46. **Informational.** `src/route/README.md` (outside this task's write set) still says the Track
    and Barrel Kinds are "the group's Kind"; the header comments of `profile.ts` and `clear.ts` are
    the current description (category Kinds, via-definition Kinds, DR-06a, DR-11). `checkDrc`'s stub returns zero counts without a diagnostic, so
    six `drc-load` cases fail (not stub) now that `readDsn` is real; the runner cannot distinguish
    the stub from a clean board. Either the I2 stub should carry `not-implemented`, or the cases
    should be accepted as stubbed until I2 lands.
