# fab_router — architecture brief

A PCB autorouter in TypeScript for Bun. SPECCTRA DSN in, SES out; tscircuit SimpleRouteJson as a
second adapter. This brief is a *recommended* design: implementers may deviate wherever the
acceptance suite in `spec/acceptance/` still passes, but the vocabulary below is binding so that
modules built by different people fit together.

The algorithms are from the published literature (see `spec/glossary.md` for citations). Nothing
here is derived from any existing router's source.

## 0. Vocabulary

Every noun is a physical thing on a board or a plain data-structure name.

| Term | Meaning |
|---|---|
| **Layout** | The whole board being routed: stack, items, nets, rules |
| **Sheet** / **Stack** | One copper layer (signal or plane) / the ordered list of Sheets |
| **Frame** | Coordinate transform between file units and layout units (scale + origin shift) |
| **Part** | A placed footprint instance (reference designator, side, rotation) |
| **PadForm** | A padstack: shape per Sheet plus optional drill |
| **Pad** | A Part's pin copper, instantiated from a PadForm on one or more Sheets |
| **Barrel** | A via: a PadForm instance not owned by a Part, spanning Sheets |
| **Track** | A routed conductor: integer polyline centreline + width on one Sheet |
| **Pour** | A filled copper area or plane, net-owned |
| **Fence** | A keepout (track / barrel / place scope), optionally per Sheet |
| **Rim** | The board outline with cut-outs; copper-to-edge spacing applies against it |
| **Net** / **NetGroup** | A net / a named group of nets carrying shared rules (width, spacing kind, via rule, usable Sheets) |
| **Kind** / **SpacingTable** | A clearance class name / the Kind × Kind × Sheet matrix of required spacings |
| **Profile** | `{width, spacing per Kind, allowed Sheets, Barrel forms}` resolved for one connection before searching |
| **Lattice** | The spatial index: per-Sheet uniform bucket grid plus an oversize shelf |
| **Quilt** / **Patch** / **Seam** | The router's lazily built free-space decomposition per Sheet (adaptive quadtree) / one free cell / a shared edge between adjacent Patches |
| **Trail** | A search result: legs `(sheet, points[])` joined by Barrel drops, before legalisation |
| **Journal** | Append-only mutation log with `mark()` / `rewind(mark)` — the undo mechanism for rip-up and optimiser trials |
| **Hold** | Item mobility: `free` (router may rip or move), `held` (user-fixed; obstacle), `locked` (system: pads, rim, fences) |

## 1. Numeric and geometry kernel — `src/geom`

**Coordinates.** Every stored coordinate is an integer `number` in *layout units* (LU). The Frame
picks LU per design: start at the file's finest resolution unit (never finer than 1 nm), shift the
origin to the bounding-box centre, and coarsen ×10 until `max(|x|,|y|) ≤ 2^25`.

Why 2^25: the orientation predicate `orient(a,b,c) = (bx−ax)(cy−ay) − (by−ay)(cx−ax)` has
differences ≤ 2^26, products ≤ 2^52, and a final difference ≤ 2^53 — exactly representable in
float64. The same bound makes `dot` and `distSq` exact. At 0.1 µm per LU that is ±3.35 m of board;
the coarsening loop is a safety net, not the normal path.

**Predicate / construction split.** Decisions use exact integer predicates (orientation, segment
intersection test, point-in-convex, on-segment, side-of-line). Constructions (intersection point,
offset vertex, projection) are float64 then snapped to integer LU with *direction-aware* rounding:
clearance expansions round outward, path points round to nearest. The ≤ 0.5 LU error is orders
below any spacing rule and is absorbed by the legaliser's final exact check.

**No bigint at runtime.** A test-only bigint oracle re-implements the predicates and fuzzes the
float64 versions near the bound. Nothing needing three-term products (in-circle, Delaunay) is
planned.

```ts
type Pt = { x: number; y: number }            // integer LU
type Seg = { a: Pt; b: Pt }
type Box = { x0: number; y0: number; x1: number; y1: number }
type Dop8 = Box & { s0: number; s1: number; d0: number; d1: number }   // bounds on x, y, x+y, x−y
type Ring = { pts: Pt[] }                     // simple polygon, CCW
type Hull = Ring & { convex: true }
type Disk = { c: Pt; r: number }
type Capsule = { seg: Seg; r: number }        // stroked segment
type Shape = Disk | Box | Hull | Capsule | { kind: "pieces"; hulls: Hull[] }
```

Operations: `orient / side / onSeg / segsIntersect`; `dist2` over every shape pair (squared
integers where possible, sqrt only at the final compare); `hullOf` (monotone chain);
`expand(shape, r, "dop8" | "euclid")` — Minkowski sum with a circumscribed regular octagon (radius
`r / cos 22.5°`, so it *contains* the Euclidean disk: conservative for the router) or the exact
rounded shape for DRC; `dop8Of`; `convexPieces(ring)` (ear-clip + Hertel–Mehlhorn merge);
`snap45 / stairs90`; `simplifyCollinear`; `bendAngle`. Pure functions over plain objects; a single
`dist2` switch over shape kinds; no class hierarchy.

## 2. Design model — `src/layout`

Plain data, structure-of-arrays where hot. All items live in one `ItemTable` with a stable integer
id; per-kind columns. Nothing holds an object pointer — ids only — which makes the Journal and
snapshots trivial. Semantics (plane Sheets, keepout scoping, fixed wiring, pour connectivity) are
defined in `spec/rules/`.

```ts
interface Layout {
  frame: Frame; name: string; angleMode: "90" | "45" | "any";
  stack: Sheet[];                 // { id, name, role: "signal" | "plane", active, preferDir: "h" | "v" | null, planeNet? }
  padForms: PadForm[];            // { id, name, perSheet: Map<sheetId, Shape[]>, drill?: { d, from, to }, attachAllowed }
  parts: Part[]; pads: Pad[]; barrels: Barrel[]; tracks: Track[]; pours: Pour[]; fences: Fence[]; rim: Rim;
  nets: Net[]; netGroups: NetGroup[];
  spacing: SpacingTable;          // kinds[], get(kindA, kindB, sheetId, pairType?)
  barrelRules: BarrelRule[];      // ordered PadForm candidates per NetGroup
  settingsFromFile?: Partial<RouteSettings>;
  warnings: Diagnostic[];
}
```

## 3. Readers and writers — `src/dsn`, `src/ses`

- `dsn/lex.ts`: `( ) symbol number string` tokens; quote character and space-in-quoted-tokens taken
  from the `(parser …)` block as soon as it is read; Windows-1252 unless a UTF-8 BOM; keywords
  case-insensitive. Behaviour defined by `spec/formats/dsn.md` and the lexeme vectors.
- `dsn/read.ts`: tree first (`SExpr[]`), then a scope walker keyed by head symbol, tolerant of
  unknown scopes (diagnostic, skip) and of files that swallow a paren. Output is `DsnDocument`, a
  file-shaped DTO in file units.
- `dsn/build.ts`: `DsnDocument → Layout` (Frame, pad instantiation with rotation/side, padstack
  name normalisation, spacing table from rules/classes/pair types, subnets, plane Sheets).
- `dsn/write.ts`: `DsnDocument → text` (round-trip tests; SRJ → DSN).
- `dsn/rules.ts`: rules-file overlay onto a Layout and settings.
- `ses/write.ts`: session file per `spec/formats/ses.md` (integer coordinates in resolution units,
  `library_out` PadForms used by written Barrels, `network_out` wires and vias).
- `ses/apply.ts`: apply a session back onto a Layout.

## 4. Spatial index — `src/lattice`

A per-Sheet **uniform bucket grid** with an oversize shelf — not a tree. Item counts are 10^4–10^5
with clustered sizes (pads, track legs, barrels ≈ 0.1–3 mm) and queries are clearance-expanded
boxes of the same scale, so a grid answers in O(cells touched + hits) with no balancing and **no
dependence on insertion order** — which matters for rip-up churn and for determinism.

Cell size = clamp(4 × median item bbox diagonal, 0.5 mm, 5 mm), chosen at build. An item spanning
more than 16 cells (pours, rim, big keepouts) goes on the per-Sheet oversize shelf, scanned on
every query. Track legs are indexed individually. Results come back in ascending id order
(generation-stamp dedup, no `Set` allocation). API: `hits(sheet, box, filter)`, `sweepHits(sheet, dop8)`.

## 5. DRC and connectivity — `src/drc`

- `spacing.ts`: for each item (or Track leg) on each Sheet, query the Lattice with the bbox
  expanded by `halfWidth + maxSpacing`, then compare exact Euclidean `dist2` against
  `spacing(kindA, kindB, sheet, pairType)²`. Pair types derive from item kinds (`smd_smd`,
  `smd_via`, `via_via`, `pin_pin`, `wire_*`, `area_*`, default). Special obstacles: the Rim
  (copper-to-edge), holes (hole clearance), Fences. `Violation { a, b, sheet, required, actual,
  at, rule }`. Router-added violations = after − before.
- `connect.ts`: union-find per net over Track–Pad, Track–Track, Barrel spans, Pour joins, plane
  Sheets. `incompletes(net) = components − 1`. `requiredConnections(layout)` = minimum spanning
  tree over components by nearest-pad distance, Kruskal, deterministic ties `(distance, idA, idB)`.
- `stats.ts`: `LayoutStats` with the vocabulary the acceptance suite compares
  (`spec/api/contract.md`).

## 6. The router — `src/route`

Per connection: resolve a **Profile**; on each usable Sheet lazily build a **Quilt** (adaptive
quadtree of free Patches, where "free" means the Lattice returns no obstacle whose Dop8 expansion
by `halfWidth + spacing` intersects the Patch); run **A\*** over `(sheet, patch)` with Seam
crossings as moves and Barrel drops as inter-Sheet moves; **string-pull** the Patch path into a
Trail using exact `sweepClear` line-of-sight checks; **legalise** (angle mode, pad entry,
neck-down, joins) with the same exact checks; insert via the Journal.

When A\* fails within budget it re-runs with **soft obstacles**: `free` items of other nets cost
`startRipupCost × (1 + history)` instead of blocking (negotiated congestion, PathFinder-style);
the winning Trail rips those items (journaled) and re-queues their connections. **Nudge** is
rip-local-reroute of conflicting neighbouring legs in a bounded window, rolled back through the
Journal on failure — chosen over geometric push-and-shove because it reuses the search and is
DRC-clean by construction; a geometric shove can be added later if the quality bar demands it. A
**Fanout** pre-pass gives SMD pads a stub + Barrel escape. The **Optimiser** re-routes each
connection with its own copper removed and keeps the result only if the score improves, then
straightens bends, eliminates Barrels, and tightens parallel legs.

**DRC-clean by construction** follows from one rule: nothing is inserted unless every leg and
every Barrel passed the exact clearance predicates against the live Lattice, with the same
same-net exemptions DRC uses. The Quilt is only a proposal generator; it can cause a miss, never a
violation. This lets the first routing milestone ship with a crude search and improve later
without touching the acceptance guarantee.

| Module | Responsibility |
|---|---|
| `profile.ts` | width (NetGroup / net / neck), spacing vector per Kind, usable Sheets, Barrel candidates in rule order, angle mode |
| `clear.ts` | `sweepClear(sheet, seg, profile, ignore)`, `barrelFits(at, form, profile)`, `pointFree`; returns blocking ids |
| `quilt.ts` | lazy adaptive quadtree per `(sheet, profile-hash)`; Morton-keyed; regionally invalidated when the Lattice changes |
| `search.ts` | A\* with a binary heap keyed `(f, h, seq)`; heuristic = octilinear distance in 45° mode, Euclidean otherwise, plus `viaCost × min barrels needed`; costs: length × preferred-direction factor, `viaCost` / `planeViaCost`, `bendCost`, soft-obstacle cost; deadline + `AbortSignal` polled every 256 pops |
| `pull.ts` | Theta\*-style shortcutting with `sweepClear`; then 45°/90°/any shaping; collinear merge |
| `legalise.ts` | pad entry, neck-down for the final leg, join / split same-net Tracks, Barrel placement, final exact re-check |
| `fanout.ts` | SMD escape candidates along the pad normal; first `barrelFits ∧ sweepClear` wins; deterministic |
| `ripup.ts` | soft-obstacle policy, per-item history, per-connection budget |
| `nudge.ts` | rip-local-reroute in a window with Journal rollback |
| `optimise.ts` | re-route-keep-if-better, bend straightening, Barrel elimination, parallel tighten |
| `passes.ts` | fanout → `maxPasses` × ordered queue of incomplete connections → optimiser; stagnation / time / item-count stops |
| `journal.ts` | `mark()`, journaled insert/remove through Layout + Lattice, `rewind(mark)`, `snapshot()` |

## 7. Pipeline and API — `src/pipeline`, `src/api.ts`, `src/cli.ts`

The public surface is fixed by `spec/api/contract.md` and `spec/api/settings.md`. Determinism: no
`Map`/`Set` iteration order reaches a routing decision (id lists are sorted); heap ties break by
insertion sequence; `Date.now` only for budgets; PRNG is a small seeded generator. Cancellation:
`signal.aborted` polled in the search loop, between connections, and between optimiser trials;
abort returns the best snapshot with `report.aborted = true`.

## 8. Layering

`geom → layout → lattice → drc → route → pipeline → {dsn, ses, srj} → api → cli`, enforced by
`bun run check:layers`; `spec/types` may be imported by everyone. Toolchain: Bun ≥ 1.4,
TypeScript strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, `bun:test`,
zero runtime dependencies.
