# SimpleRouteJson: the tscircuit routing-problem format

The public tscircuit **SimpleRouteJson** (SRJ) format is a routing problem stated in
millimetres. `routeSrj` (`spec/api/contract.md`) reads it, routes it, and returns the same
object with routed copper attached. This file defines, as observable behaviour, how an SRJ
document maps onto a Layout and how the routed copper is reported. Clauses are `J-nn`.

SimpleRouteJson is tscircuit's own published shape; its keys (`layerCount`, `bounds`,
`obstacles`, `connections`, `differentialPairs`, `minTraceWidth`, …) are used verbatim below and
mirrored in `spec/types/srj.ts`. Where two reference autorouters were observed to disagree, both
observations and the spec's ruling are recorded inline.

## 1. Units, axes, and the coordinate map

- **J-01 Units are millimetres.** Every coordinate, width, diameter, gap and tolerance in an SRJ
  document is a millimetre value (a float). The `y` axis grows **up**; there is no axis flip
  between input and output. Output copper (`J-40`..`J-43`) is emitted in the same millimetre
  frame, so an input point and the routed copper that reaches it share one coordinate system.
- **J-02 The Frame.** The adapter maps millimetres to the Layout's integer LU (`glossary.md`)
  through a Frame whose grid step is fine enough that no input geometry is lost: a step of one
  micrometre or finer satisfies this on every board in the corpus. *Reference divergence:* one
  reference maps at a tenth of a micrometre per file unit, the other at one micrometre per LU;
  both preserve the corpus geometry, so the spec fixes only the ceiling (**at most one
  micrometre per LU**) and leaves the exact step to the implementation.
- **J-03 Round-trip fidelity.** A coordinate emitted in the output (`J-40`) equals the routed
  copper's position converted back to millimetres through the same Frame; it need not equal any
  input coordinate exactly, but it lies on the Frame grid.

## 2. Stack

- **J-10 Layer count and names.** `layerCount` copper layers are created and none is ever
  collapsed away: a six-layer input yields a six-Sheet Layout. The layers are named, in Stack
  order, `top`, then `inner1`, `inner2`, … `inner(layerCount − 2)`, then `bottom`; a
  single-layer input is just `top`. Every point, obstacle and via names its layer by one of
  these names, and an SRJ document that names a layer outside this set is rejected.
- **J-11 All layers routable.** Every SRJ layer is a signal (routable) Sheet. SRJ has no plane
  Sheets; a power/ground region arrives as an obstacle (`J-22`), not as a plane.

## 3. Bounds → Rim

- **J-15 `bounds` is a routing window, not a board edge.** By default the Rim is the `bounds`
  rectangle **grown outward by one millimetre** of bookkeeping room. The observable purpose:
  copper that legitimately reaches the `bounds` rectangle — the common case, because a converter
  usually emits the content's bounding box as `bounds` — is not counted as a board-edge
  clearance Violation. *Observed:* on the two-layer J802 board, reading `bounds` as the physical
  board edge produces 15 edge Violations before any routing; the one-millimetre window reading
  produces 0. The spec keeps the window reading as the default so `violationsBefore` is 0.
- **J-16 Physical-outline opt-in.** A caller whose `bounds` really is the board edge may ask for
  the rectangle to be used verbatim as the Rim; then a declared `minBoardEdgeClearance`
  (millimetres) is enforced as a copper-to-edge clearance and copper reaching the rectangle
  edge Violates. When the window reading is in force a declared `minBoardEdgeClearance` is still
  enforced as a clearance class. This choice is a recorded run setting, never silent.

## 4. Connections and endpoints

- **J-20 One Net per connection.** Each entry of `connections` becomes one Net whose name is the
  entry's `name`. Its `pointsToConnect` are the Net's terminals. `netConnectionName`, when
  present, is an **alias** for the same Net: an obstacle or reference that names either the
  `name` or the `netConnectionName` resolves to this one Net (`J-22`).
- **J-21 Endpoints are fixed single-pad terminals.** Each `pointsToConnect` point becomes one
  Part with a single Pad, placed at the point, `hold: "locked"`, on the point's own layer only.
  The Pad's copper is a circle whose diameter is at least the trace width and at least 0.30 mm,
  except that a differential-pair member's endpoints (`J-30`) use the trace-width diameter so
  neighbouring pair pads at pair pitch do not touch. A point may carry a `pointId`; when present
  it is preserved so the caller can correlate an output trace with the input point.
- **J-22 Required links come only from `pointsToConnect`.** For a connection with *k* points the
  required links are the edges of a minimum spanning tree over those *k* points, i.e.
  `max(0, k − 1)` links (`spec/rules/connectivity.md`). On every J802 board each connection has
  exactly two points, so each contributes exactly one required link. Pre-existing net-owned
  copper (`J-23`) does **not** add required links — see the Q-68 ruling in section 7.

## 5. Obstacles

- **J-23 Net-owned copper vs. keepout.** An obstacle's `connectedTo` is a list of the connection
  names (or net aliases, `J-20`) whose copper the obstacle is.
  - When `connectedTo` names exactly one connection, unambiguously (every listed name resolves
    to the same single Net), the obstacle is that Net's own **fixed (held) copper**: the router
    may attach the Net's routes to it, and it is an obstacle (keepout) to every other Net. It is
    *not* an independent connectivity terminal (Q-68, section 7).
  - When `connectedTo` is empty, the obstacle is a plain keepout that blocks every Net
    (a Fence, `glossary.md`).
  - When `connectedTo` names an owner that resolves to **no** routed connection, the name is
    reported to the caller and, by default, the obstacle stays a plain keepout. A caller may opt
    to treat such copper instead as attachable fixed copper of a synthesized context Net under
    that name (blocking to every routed Net, connectable by its own name); this is a recorded
    setting. See `J-25`.
- **J-24 Obstacle shapes.** `type` is `rect`, `oval`, or `polygon`.
  - A `rect` is a rectangle at `center` with `width` × `height`, rotated counter-clockwise by
    `ccwRotationDegrees` (default 0).
  - An `oval` is the corresponding rounded/elliptical copper at `center` with `width` × `height`.
  - A `polygon`, and any obstacle that a centre/size cannot describe, is given by an explicit
    outline in the `polygon` field (millimetres, board coordinates), used verbatim. The key
    `points` is accepted as an exact synonym for `polygon`.
  - An obstacle whose `type` is not a rectangle and that supplies neither `width`/`height` nor an
    outline is **refused** (import fails, `J-26`) rather than silently squared off.
  - An obstacle lists the `layers` it occupies; it becomes copper/keepout on each named Sheet.
- **J-25 Buried-endpoint conflict.** An obstacle that covers a declared endpoint contradicts the
  document: `pointsToConnect` must be reachable, yet copper the router may never touch would sit
  on the point. The default resolution depends on ownership:
  - A plain keepout, or an obstacle whose owner matches no routed connection, that covers a
    declared endpoint is a hard conflict: import fails (`J-26`), listing every offending
    obstacle and the endpoint it buries.
  - A caller may opt out per contradiction: either drop the burying obstacle, or (for the
    unmatched-owner case) import it as attachable context copper of a Net under its name so the
    endpoint's own Net connects to it rather than being buried. Either choice is recorded.
  - *Observed:* the three six-layer J802 boards each carry seven `GND`-owned pads that cover
    declared endpoints and whose owner `GND` matches no routed connection; they are refused by
    default and import only under the context-net reading, after which the boards route (section
    7). The two-layer J802 board has no such conflict and imports with no opt-in.
- **J-26 Import fails closed.** When the document cannot be represented faithfully (`J-24`,
  `J-25`, or `J-31`), `routeSrj` returns `ok: false` with a diagnostic that names **every**
  refusal — not just the first — so the caller can fix or waive them in one pass; no partial
  board is routed.

## 6. Vias and trace width

- **J-27 Trace width.** The default routed width is `nominalTraceWidth` when present, else
  `minTraceWidth`. A connection may override it with its own `nominalTraceWidth`.
- **J-28 Default clearance.** The default copper-to-copper clearance is `defaultObstacleMargin`
  when present, else 0.20 mm.
- **J-29 Vias.** A single through-via form is offered to every Net, spanning all `layerCount`
  Sheets, with a round pad of diameter `minViaPadDiameter` (default 0.5 mm) and a drill of
  `minViaHoleDiameter` (default 0.3 mm).
- **J-31 Via sizing is verbatim.** A declared `minViaPadDiameter` is used exactly, even below
  0.5 mm (the two-layer J802 board declares 0.45 mm and gets a 0.45 mm via pad): it is never
  silently rounded up to a different board. A non-positive `minViaPadDiameter` is refused
  (`J-26`); a caller may opt to accept the nearest supported pad instead.

## 7. Differential pairs (Q-67) and the pre-existing-copper ruling (Q-68)

### Q-67 — differential-pair field names

- **J-30 Field names.** The corpus writes each entry of `differentialPairs` as
  `{ connectionNames: [<a>, <b>], lengthTolerance, traceGap?, maxUncoupledLength?, standardId? }`,
  all lengths in millimetres, where `connectionNames` holds the two member connection names —
  observed as `[<…_N>, <…_P>]`, i.e. the `_N`-suffixed member first and the `_P`-suffixed member
  second. `spec/types/srj.ts` currently declares instead `{ p, n, gapMm?, skewToleranceMm? }`.

  **Ruling (Q-67): the adapter must accept both spellings.** For each pair:
  - the `_P`-suffixed member of `connectionNames` (else `p`, else the entry at index 1) is the
    pair's **P** member; the `_N`-suffixed member (else `n`, else the entry at index 0) is the
    **N** member;
  - the skew (length-mismatch) tolerance is `skewToleranceMm` when given, else `lengthTolerance`;
  - the coupling gap is `gapMm` when given, else `traceGap`;
  - `maxUncoupledLength` and `standardId`, when present, are carried through and reported, not
    required.

  **Proposed `spec/types/srj.ts` change** (for the orchestrator to apply — `spec/types` is not in
  this task's write set): widen `SrjDifferentialPair` to the union of both spellings, e.g.

  ```ts
  export interface SrjDifferentialPair {
    // corpus spelling
    connectionNames?: [string, string];
    lengthTolerance?: number;   // mm, skew tolerance
    traceGap?: number;          // mm, coupling gap
    maxUncoupledLength?: number;// mm
    standardId?: string;
    // legacy spelling
    p?: string; n?: string; gapMm?: number; skewToleranceMm?: number;
  }
  ```

  with the resolution rules above defining the canonical `{ p, n, skew tolerance, gap }` the
  router uses. A document that gives neither a `connectionNames` pair nor both of `p`/`n` names
  no pair and is ignored with a diagnostic.

- **J-32 Pair measurement, not pair routing.** For every declared pair the result reports, per
  pair, whether **both** members routed, each member's routed copper length (millimetres), the
  length mismatch, the tolerance, and whether the mismatch is within tolerance. *Coupled* pair
  routing (holding the two members side by side at `traceGap`) is **not** required by this spec
  and neither reference performs it: the members route independently and the mismatch is
  whatever independent routing produced. A caller that needs the coupling contract must gate on
  the per-pair measurement. Accordingly the per-pair skew figures in the acceptance cases are
  advisory (section 8).

### Q-68 — pre-existing net-owned copper is attachable, not re-stitched

Each J802 board declares exactly **15 connections**, every one with two `pointsToConnect`, and
thousands of obstacles almost all carrying a `connectedTo` (the two-layer board: 1032 obstacles,
1031 owned; each six-layer board: ~5200 obstacles, all owned). Two readings were considered:

- **(a)** each fragment of a Net's pre-existing copper is an independent connectivity terminal
  that must be re-stitched — which, counting every owned obstacle as a terminal, yields on the
  order of 52 (two-layer) / 188 (six-layer) required connections;
- **(b)** pre-existing net-owned copper is same-net copper the router **may attach to but need
  not stitch**, and the required links come only from `pointsToConnect` — which yields **15**
  required connections per board (`J-22`).

**Observed:** run as a sealed program, the reference autorouter evaluates exactly **15**
connections on every J802 board (one per `connections` entry), never one per copper fragment; a
connection is judged complete when its two declared endpoints are electrically joined, using the
owned copper freely as a helper. It does not re-stitch copper fragments.

**Ruling (Q-68): reading (b).** SRJ required connections come only from `pointsToConnect`;
pre-existing net-owned copper (`J-23`) is attachable same-net copper and is **not** an
independent connectivity terminal. See `spec/rules/connectivity.md` (SRJ section, K-13..K-15)
for the counting consequence. *Reason:* the reference program routes and counts this way, and
reading (a) would demand tens to hundreds of via-hungry re-joins of copper the board already
has whole.

**Observed reference numbers** (the sealed reference program, all four boards, 60 s budget; the
six-layer boards imported under the context-net reading of `J-25` that they require):

| Board | Sheets | Required connections | Complete | Incomplete after | Violations before | Violations after |
|---|---|---|---|---|---|---|
| `b223-j802.srj.json` | 2 | 15 | 12 | 3 | 0 | 0 |
| `b223-j802-six-layer.srj.json` | 6 | 15 | 0 (budget exhausted) | 15 | 0 | 0 |
| `b223-j802-six-layer-v2.srj.json` | 6 | 15 | 9 | 6 | 0 | 0 |
| `b223-j802-six-layer-v3.srj.json` | 6 | 15 | 9 | 6 | 0 | 0 |

(`v2` and `v3` are byte-identical inputs.) On all four boards no Violation is present before
routing and none is added: `violationsAdded` is 0 throughout, upholding R-1
(`spec/api/contract.md`). Completion is via-dependent: it improves once the barrel-aware search
(milestone I5) lands, because most links join endpoints on different Sheets and so need a via.

## 8. Output: the routed document

- **J-40 Same object, copper attached.** `routeSrj` returns the input SimpleRouteJson with a
  `traces` array of `pcb_trace` records and a routing `report` (`spec/api/contract.md`,
  `SrjRouteResult`).
- **J-41 One record per physical copper item.** Each routed conductor (a Track) and each via
  (a Barrel) becomes exactly one `pcb_trace` record: `{ type: "pcb_trace", pcb_trace_id,
  connection_name, route: [...] }`. `connection_name` is the item's Net name. Separate records
  never imply a segment joining them; each record is one board item.
- **J-42 Track records.** A Track's `route` is a list of `wire` steps, one per centreline
  corner, each `{ route_type: "wire", x, y, width, layer }` in millimetres with the Sheet's name
  (`J-10`). A straight Track with two corners has two `wire` steps.
- **J-43 Via records.** A via's `route` is a single `via` step,
  `{ route_type: "via", x, y, from_layer, to_layer }`, at the via centre in millimetres, naming
  the outermost Sheets of its span.
- **J-44 Per-pair report.** The result carries one measurement per declared differential pair
  (`J-32`): the two member names, whether both routed, each routed length, the skew (mismatch),
  and whether it is within tolerance.
- **J-45 Violation accounting.** The result copies `violationsBefore` and `violationsAdded` from
  the routing report (Q-I0-8). The `srj` acceptance kind reads `violationsAdded` for its
  `violations.maxAdded` metric.

## 9. Acceptance

The `srj-*` cases (`spec/acceptance/cases/srj-*.json`, kind `srj`) run `routeSrj` on the four
J802 boards. On every case `violations.maxAdded` is **0** (hard, R-1). The `incomplete` bound is
a via-dependent completion target drawn from the reference numbers above and is marked so it
becomes reachable once the barrel-aware search (I5) lands; per-pair `skewMm` bounds are advisory
because neither reference couples pairs (`J-32`). Reference numbers are recorded in
`spec/acceptance/reference/b223-j802*.srj.default.json`.

## Citations

- SimpleRouteJson is tscircuit's published routing-problem format; its keys are used as tscircuit
  writes them.
- SPECCTRA Design Language Reference (Cadence, v10.1, 2003) — the DSN/SES formats the Layout and
  session share (`spec/glossary.md`).
- Kruskal (1956) — the minimum-spanning-tree definition of required links (`J-22`,
  `spec/rules/connectivity.md`).
