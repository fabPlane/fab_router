# `src/lattice` — spatial index

A per-Sheet uniform bucket grid with an oversize shelf (`docs/DESIGN.md` §4): items are indexed by
their 8-DOP bounds, queries are clearance-expanded boxes or swept 45° legs, results come back in
ascending id order with no dependence on insertion order — which is what rip-up churn and
determinism need. Cell size is chosen at build from the median item size; items spanning many
cells live on the shelf scanned by every query. Literature: Klosowski et al. (1998) for k-DOP
bounds; Guttman (1984) R-trees and Beckmann et al. (1990) R*-tree considered and rejected for the
clustered sizes and balance-free updates a router wants. Task I3 implements the interface fixed
in `index.ts`.
