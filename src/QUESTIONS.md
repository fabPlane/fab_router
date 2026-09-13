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
