# `src/route` — the router

Per connection: resolve a Profile, lazily build a Quilt (adaptive quadtree of free Patches per
Sheet — Finkel & Bentley 1974; a gridless tile view in the spirit of Dion & Monier's Contour
1995), run A* (Hart, Nilsson & Raphael 1968) over `(sheet, patch)` with Seam crossings and Barrel
drops as moves, string-pull the Patch path with exact line-of-sight checks (Theta*, Nash et al.
2007), legalise (angle mode, pad entry, neck-down, joins) with the same exact checks, and insert
through the Journal. Failures fall back to negotiated congestion with rip-up (Dees & Karger 1982;
McMurchie & Ebeling 1995 PathFinder history costs) and to a bounded rip-local-reroute nudge; a
fanout pre-pass escapes SMD pads and an optimiser re-routes keep-if-better. The invariant that
makes the whole thing DRC-clean by construction: nothing is inserted unless every leg and Barrel
passed the exact clearance predicates against the live Lattice. Task I4 implements the single-Sheet
core below; I5 adds Barrels, fanout, nudge and the optimiser.

## `profile.ts` and `clear.ts` (task I3)

**Profile** — `resolveProfile(layout, net, settings)` resolves, for one connection, the width
(the NetGroup's; `spec/rules/nets.md` N-06/N-08), the neck width (`neckWidthUm`, never wider than
the width), the Track and Barrel Kinds (the group's Kind, `spec/rules/clearance.md` C-11), the
spacing row `spacingByKind` (largest value over the usable Sheets per Kind — a conservative margin
for the search; exact checks read the SpacingTable per Sheet), the usable Sheets (`use_layer` ∩
signal role ∩ active, `spec/rules/layers.md` L-04/L-08), the Barrel candidates in via-rule order
(`spec/rules/vias.md` V-03/V-06; empty under `viasAllowed: false`, V-09), the angle mode, whether
the net owns a plane Sheet, and the hole / copper-to-edge clearances of the run in LU (C-04
rounding).

**Clearance queries** — `sweepClear(layout, lattice, sheet, seg, profile, ignore, width?)`,
`pointFree(…)` and `barrelFits(layout, lattice, at, candidate, profile, ignore)` return
`{ ok, blocking }` where `blocking` lists the ids of the items in the way (the Rim as `RIM_ID`),
ascending. "Clear" is exactly "no Violation" in the sense of `spec/rules/drc.md`: the Euclidean
distance from the new copper to every other-net item's copper on the Sheet is ≥
`spacing(kindA, kindB, sheet)` (strictly less is blocked; equal is clear), same-net copper is
exempt (DR-02), Pours never block (K-05), Kind-`null` items never push copper away (C-01), Fences
apply by scope (`spec/rules/keepouts.md` KO-01; a Kind-`null` Fence is a wall that may not be
touched, DR-03), the Rim is measured as zero-width polylines with the run's copper-to-edge override
when set (C-15), hole clearance (DR-06) is applied when the Profile carries one, and a Barrel may
overlap a same-net Pad only with attach on an SMD Pad (V-08; coincident drills are blocked).
`ignore` names the connection's own item ids and its net.

Candidates come from the Lattice with the bounds expanded by halfWidth + the largest margin
(`spacing.max` of the Kind, hole and edge clearances); the decision is the squared comparison
`dist²(coreA, coreB) < (required + rA + rB)²` over the convex cores of `src/geom` — no square root,
exact whenever the nearest core points are vertices, and the same formulation a DRC can use so the
two never disagree on ties.

Tests: `test/clear-vs-drc.test.ts` (every Track leg and Barrel of synthetic boards against a
brute-force DRC oracle with and without hole / edge clearance, plus hand-built boundary cases).

## The single-Sheet router (task I4)

The pass loop (`passes.ts`) sweeps the Layout's incomplete required connections (from `src/drc`
`requiredConnections`, Kruskal MST over terminal components) over `maxPasses` passes, stopping on
completion, stagnation (`maxStagnantPasses`), the `maxItems` connection cap, `timeBudgetMs`, or an
`AbortSignal`. For one connection it resolves the Profile, intersects the two endpoints' Sheets
with the Profile's usable Sheets (this milestone completes each connection on a single Sheet — no
Barrels, `viasAllowed: false` semantics), then:

1. **Line probes** (Soukup 1978): the direct leg and the two L / staircase corners, shaped to the
   angle mode and re-checked exactly — the fast path for short and clear-shot nets.
2. **A\*** (`search.ts`; Hart, Nilsson & Raphael 1968) over the **Quilt** (`quilt.ts`): a lazily
   built, Morton-keyed (Finkel & Bentley 1974) uniform grid of free Patches per `(sheet, profile)`
   whose "free" is decided by the exact `pointFree` / `sweepClear` predicates of `clear.ts`; the
   search state carries `(sheet, patch)` so I5 adds Barrel moves without restructuring. Coarse
   pitch first, then a half-pitch grid to weave through tighter gaps. Determinism: a binary heap
   keyed `(f, h, seq)`, fixed neighbour order, no Map/Set iteration in a decision (docs/DESIGN.md
   §7).
3. **Pull** (`pull.ts`; Nash et al. 2007, Theta\*) shortcuts the staircase with exact line-of-sight
   checks, and **legalise** (`legalise.ts`) shapes to the angle mode (`snap45` / `stairs90`) and
   re-checks every leg exactly before inserting through the **Journal** (`journal.ts`).

When the hard search fails and `ripupEnabled`, the search re-runs with **soft obstacles**
(`ripup.ts`; Dees & Karger 1982, McMurchie & Ebeling 1995): `free` other-net Tracks / Barrels
become passable at `startRipupCost × (1 + history)`, the winning Trail rips exactly those items
through the Journal (bounded by a per-connection budget), and a later pass re-routes them.

**DRC-clean by construction (contract R-1):** nothing reaches the Journal unless every leg passed
the same exact clearance predicate a DRC uses, so `violationsAdded` is 0 on every board. `held` /
`locked` items are never moved or ripped (R-2); one Track is inserted per completed connection so
`added ≤ completed ≤ maxItems` (R-5); no Barrel is ever added this milestone (R-4). Everything the
router inserts carries `origin: "router"` (Q-I2-60).
