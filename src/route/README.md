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
