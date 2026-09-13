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
passed the exact clearance predicates against the live Lattice. Tasks I4/I5 implement; this task
fixes the Trail and report vocabulary.

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
