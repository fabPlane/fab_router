# `src/drc` — design-rule check, connectivity, statistics

The bodies behind `checkDrc`, `layoutStats` and `requiredConnections` (`spec/api/contract.md`
"Checking and measuring"; semantics in `spec/rules/drc.md` and `spec/rules/connectivity.md`;
`docs/DESIGN.md` §5). Everything is pure: each call builds a fresh Lattice over the Layout, sweeps
it, and returns plain data (DR-10). Literature: Tarjan (1975) union-find, Kruskal (1956) minimum
spanning tree, Shewchuk (1997) for why every decision is an exact predicate.

| Module | Contents |
|---|---|
| `exact.ts` | the decisions: `closer(a, b, required)` ⇔ `dist²(coreA, coreB) < (required + rA + rB)²`, `touching` ⇔ `≤ (rA + rB)²` over the convex cores of `src/geom` — no square root, exact whenever the nearest core points are vertices, the same formulation as the router's `src/route/clear.ts` so router and DRC agree on ties; `distance` and `gapPoint` for `Violation.actual` / `at`; `crossesEdge` / `withinRim`, the DR-11 rule of ruling Q-I3b-43 in the same words as the router's (the layering keeps `drc` below `route`, so it is restated here) |
| `pour.ts` | the filled area of a Pour (outline minus holes) against a shape: an outline edge within the radius touches; otherwise a core point decides inside / outside with the exact crossing-number test, then the holes the same way (K-03); `poursTouch` for Pour–Pour |
| `connect.ts` | joins (K-01 copper overlap on a Sheet, K-02 an item is one thing across its span, K-03/K-04 Pours) found through the Lattice with the item's own bounds, union-find per net, terminal components (K-08), Kruskal over terminal components with anchors = Pad / Barrel centres and Pour vertices, ties by the lower id pair (K-11) |
| `spacing.ts` | the clearance sweep: every Pad (per Sheet of its span), Barrel (per copper Sheet, plus the drill's Sheets under hole clearance, DR-06a), Track leg → Lattice query with bounds expanded by `spacing.max(kind)` + hole + edge clearance → exact decision per rule (`spacing`, `fence`, `rim`, `hole`); counting per DR-04 |
| `stats.ts` | `LayoutStats`: item counts, `connections.maximum` (K-10) and `.incomplete` (K-09) with `ignoreNetGroups` (N-07), Barrel spans by PadForm (V-01), Track length / legs / bends (exact turn test of `src/geom`), violations by rule, fanout (L-10, RV-18) |
| `index.ts` | `analyse` (one Lattice, one sweep, one connectivity pass), `checkDrc`, `layoutStats`, `requiredConnections`, `DrcOptions` µm → LU with the C-04 rounding |

## Rules as implemented

- **Spacing** (DR-01/02/07): other-net Pad / Barrel / Track pairs on a Sheet, both Kinds ≠ null,
  strictly closer than `spacing.get(kindA, kindB, sheet)` (default pair type, Q-I3-19). Same-net
  pairs are never checked; `net: null` shares no net with anything.
- **Fences** (DR-03, KO-01, KO-05): `track` Fences against Pads, Barrels and Tracks; `barrel`
  Fences against Barrels; `place` never. A Kind-null Fence is a wall: touching is a violation
  (Q-I3-22). A Part-owned Fence (an image keepout — the footprint's own non-plated holes, which
  KiCad exports at the NPTH pad size and which overlap the footprint's own pads on `cm5-carrier`
  and the dev-board) is not checked against Pads, except under `holeClearanceUm`, when a Part-owned
  circular Fence becomes a `hole_edge` Fence with `max(table, hole)` against everything (C-15,
  KO-07; the `drc-load-issue575-dev-board*` cases). Board-owned Fences are checked against Pads
  (KO-06).
- **Rim** (DR-03, C-15, DR-11): copper closer than `spacing(kind(Rim), kind(item))` — or the
  run's `copperToEdgeClearanceUm`, which replaces it for every pair (Q-I3-21) — to the outline /
  cut-out polylines, once per (item, Sheet) (`cm5-carrier`: 2 SMD Pads + 2 through Pads × 6 Sheets
  = 14). DR-11 (crossing an edge, outside the outline, inside a cut-out) applies to copper with
  Hold `free` — what the router adds; held and locked copper is the file's and is measured by
  DR-03 only (the Mars-64 `ses-apply` sessions hold 41 off-board Tracks and expect 1 violation).
- **Holes** (DR-06, DR-06a): with `holeClearanceUm` > 0, a drill enlarged by the clearance against
  other-net copper on every Sheet of the drill's span (copper or not, Q-I3b-44) and against every
  other-net drill on any Sheet; one Violation per (drill, item) with `a` = the drilled item and
  `b: "hole"`.
- **Pours** are never part of a Violation (K-05) and Kind-null items never push copper (C-01).

## Connectivity

Joins are found per item and Sheet by querying the Lattice with the item's own bounds (a Track leg
at a time) and testing the exact contact: `touching` for copper–copper, `shapeTouchesPour` for
copper–Pour (holes subtracted: a Pad inside a thermal-relief window is joined only through a
spoke), `poursTouch` for Pour–Pour. A Barrel or through Pad is one item, so whatever it touches on
any Sheet of its span is one component (K-02). Dangling stubs are components that do not count
(K-08); `incomplete` = Σ max(0, terminal components − 1) (K-09); `maximum` = Σ max(0, Pads +
Pours − 1) (K-10). `requiredConnections` and `checkDrc().incompletes` list the Kruskal tree with
`from` / `to` the anchor items of the closest pair and `airlineLu` their distance.

Tests: `test/drc.test.ts` (a brute-force oracle over the synthetic boards of `test/helpers/synth.ts`
— every pair on every Sheet with `src/geom` `dist2` and the router's DR-11 predicates — must give
the same multiset of violations as `checkDrc` in 24 variants; hand-built boards for each clause;
`layoutStats` fields), `test/applied-ses.test.ts` (38 reference sessions), the `drc-load` and
`ses-apply` acceptance cases.
