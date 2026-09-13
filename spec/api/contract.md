# Public API contract

The module `src/api.ts` exports exactly the functions below (implementers may export more from
internal modules, but the acceptance runner compiles against these). Types are in `spec/types/`.
Expected failures are values, never exceptions: every function returns a result object with
`ok: true | false`; exceptions are reserved for programming errors.

## Reading and writing

```ts
readDsn(text: string, opts?: { name?: string }): ReadResult
//  ok:  { ok: true, layout: Layout, document: DsnDocument, diagnostics: Diagnostic[] }
//  err: { ok: false, error: ParseError, diagnostics: Diagnostic[] }
writeDsn(document: DsnDocument): string
writeSes(layout: Layout, opts?: SesWriteOptions): string
applySes(layout: Layout, sesText: string): ApplyResult      // { ok, applied: { tracks, barrels }, diagnostics }
readRules(text: string): RulesResult                          // { ok, rules: RulesFile, diagnostics }
applyRules(layout: Layout, rules: RulesFile): Layout          // returns the same Layout, mutated
parseSummary(read: ReadResult & { ok: true }): ParseSummary  // the normalised summary of spec/acceptance/parse/README.md
```

- `readDsn` never throws on malformed input; it returns `ok: false` with a `ParseError { line,
  column, message }` only when no `pcb` scope can be recovered. Recoverable problems (unknown
  scopes, unresolved padstack references, degenerate keepouts, missing outline) are
  `Diagnostic { level: "warning" | "info", code, message, where? }` and the read still succeeds.
- `writeDsn(readDsn(t).document)` re-read must deep-equal the original document (`F-ROUNDTRIP`).
- `writeSes` output re-read by `applySes` on a fresh `readDsn` of the same board yields the same
  Track and Barrel counts and the same DRC statistics (`spec/formats/ses.md`). `writeSes` is
  defined only for a Layout obtained from a successful `readDsn` (RV-21).
- `readRules` returns `ok: false` only when the text has no `(rules pcb <name> …)` head. A header
  name that differs from the Layout's name is a `warning` diagnostic, not a rejection (RV-05).
- `applyRules` sets `layout.settingsFromFile` to the rules file's settings block when it has one;
  otherwise the DSN's block stays (RV-11).

## Checking and measuring

```ts
checkDrc(layout: Layout, opts?: DrcOptions): DrcResult
//  { violations: Violation[], incompletes: Incomplete[], counts: { violations, incompletes } }
layoutStats(layout: Layout, opts?: StatsOptions): LayoutStats
requiredConnections(layout: Layout): Connection[]
```

`LayoutStats` (see `types/results.ts`) carries the numbers every acceptance case compares:

| Field | Meaning |
|---|---|
| `items.pads, .barrels, .tracks, .pours, .fences` | counts of items on the Layout |
| `connections.maximum` | sum over nets of `max(0, Pads + Pours − 1)`; independent of wiring (`spec/rules/connectivity.md` K-10) |
| `connections.incomplete` | connections not realised now |
| `barrels.total, .through, .blind, .buried` | Barrel counts by span |
| `tracks.totalLengthLu, .totalLengthMm, .legs, .bends90, .bends45, .bendsOther` | Track geometry totals |
| `violations.total, .byRule` | DRC violations now |
| `fanout.smdPads, .escaped, .viaEscaped?` | SMD Pads; how many are *escaped* — touched without violation by a same-net Track or Barrel, or lying in a same-net Pour; optionally how many are touched by a Barrel directly or through one Track (RV-18) |

Counting rules: a violation is one unordered item pair on one Sheet (never counted twice) and
same-net pairs are exempt (`spec/rules/drc.md` DR-02); `connections.maximum` depends only on the
file's Pads and Pours and does not change when routing adds Tracks; `incomplete` counts terminal
components − 1 per net under the connectivity rules of `spec/rules/connectivity.md` (K-08).

## Routing

```ts
route(layout: Layout, settings?: Partial<RouteSettings>, hooks?: RouteHooks): RouteReport
routeDsn(dsnText: string, settings?: Partial<RouteSettings>, hooks?: RouteHooks): RouteDsnResult
//  { ok, ses: string, report: RouteReport, statsBefore: LayoutStats, statsAfter: LayoutStats, diagnostics }
routeSrj(srj: SimpleRouteJson, settings?: Partial<RouteSettings>, hooks?: RouteHooks): SrjRouteResult
```

`route` mutates the Layout in place (through its Journal) and returns

```ts
interface RouteReport {
  passes: number;                       // routing passes actually run
  attempted: number; completed: number; incompleteBefore: number; incompleteAfter: number;
  added: { tracks: number; barrels: number };
  ripped: number;                       // items removed by rip-up (counted once per removal)
  violationsBefore: number; violationsAdded: number;   // violationsAdded must be 0 unless strictDrc is false and the input already violated in the same region
  timedOut: boolean; aborted: boolean; stoppedBy: "complete" | "maxPasses" | "stagnant" | "maxItems" | "timeBudget" | "abort";
  effectiveSettings: RouteSettings;     // fully resolved: angleMode is never absent here (RV-22)
  wallClockMs: number;                  // advisory
  perNet: Array<{ net: string; incomplete: number }>;   // one entry per net with a required connection
}
```

Invariants (`R-1`…`R-5`, tested by every routing case):

- **R-1** `violationsAdded === 0` for every case, on every board, at every setting.
- **R-2** Items with `hold: "held"` or `"locked"` are never moved or removed.
- **R-3** `report.added` equals the difference in item counts before and after.
- **R-4** With `viasAllowed: false`, no Barrel is added; Barrels already in the file stay, and a
  connection whose ends lie on different Sheets with no pre-existing Barrel path is left incomplete.
- **R-5** With `maxItems: n`, `report.completed ≤ n`.
- **R-6** After the optimiser, the Barrel count and the total Track length do not exceed their
  pre-optimiser values, no complete connection becomes incomplete, and R-1/R-2 still hold.

## Hooks and cancellation

```ts
interface RouteHooks {
  signal?: AbortSignal;
  onPass?(e: { pass: number; incomplete: number; elapsedMs: number }): void;
  onConnection?(e: { net: string; from: string; to: string; ok: boolean; elapsedMs: number }): void;
  onProgress?(e: { done: number; total: number; elapsedMs: number }): void;
  onLog?(level: "info" | "warn", message: string): void;
}
```

Abort (`signal.aborted`) is observed within 250 ms of being raised on any board in the corpus,
and `route()` returns the best-so-far Layout state with `report.aborted = true` and R-1..R-5 still
holding.

## SimpleRouteJson

`types/srj.ts` mirrors the public tscircuit SimpleRouteJson format (mm units, `layerCount`,
`bounds`, `obstacles`, `connections`, `differentialPairs`, `minTraceWidth`). `routeSrj` returns
the same object with `traces` filled (`pcb_trace` elements with `wire` and `via` steps) and a
`report`. `spec/formats/srj.md` defines the mapping to a Layout.

## CLI

`bun run src/cli.ts route <in.dsn> -o <out.ses> [--rules f] [--set k=v]... [--json report.json]`,
`… drc <in.dsn>`, `… stats <in.dsn>`. Exit 0 on success, 2 on parse failure, 3 on R-1 breach.

## Rulings on implementer questions

Numbered `Q-<task>-<n>`; each answers the question of that number in `src/QUESTIONS.md`.

- **Q-I0-2** `RulesResult` is `{ ok: true, rules, diagnostics } | { ok: false, error: ParseError,
  diagnostics }` (`types/results.ts`).
- **Q-I0-3** The parse summary is public: `parseSummary(read)` in `src/api.ts`, computed from the
  Layout and the document together; its shape is `spec/acceptance/parse/README.md`.
- **Q-I0-4** `SpacingTable.kinds[0]` is the empty string in the Layout and is printed as `null`
  in the summary.
- **Q-I0-5** Every case carries its own `tier`; the manifest tier is the curators' default only.
- **Q-I0-6** The default preferred direction is applied when the router builds per-Sheet costs
  and is **not** materialised into `effectiveSettings.layers`.
- **Q-I0-7** The routing metric is `barrels`; `vias` is accepted as an alias.
- **Q-I0-8** SRJ inputs are `boards/*.srj.json`. `SrjRouteResult` gains `violationsBefore` and
  `violationsAdded` (copied from the report); the `srj` kind's `violations` metric with
  `maxAdded` compares `violationsAdded`.
- **Q-I0-9** For `drc-load`, only `copperToEdgeClearanceUm`, `holeClearanceUm`,
  `ignoreNetGroups` reach `DrcOptions`; other settings are ignored.
- **Q-I0-10** `spacingUm:<A>:<B>` is measured on Sheet 0 with pair type `default`.
- **Q-I0-11** Without `FAB_ROUTER_ACCEPT_STUBS`, a case whose board, rules, session, reference
  or expected file is missing **fails**.
- **Q-I0-12** The float64-exactness requirement covers the predicates (`orient`, `onSeg`,
  `segsIntersect`, squared distances). Polygon area is not a predicate: an implementation must
  return the exact doubled area for any simple ring within the coordinate bound and may use
  arbitrary-precision arithmetic to do so.
- **Q-I0-13** `writeDsn` / `writeSes` return strings; they are defined only for documents and
  Layouts obtained from a successful `readDsn`, so no `ok` envelope is needed.
