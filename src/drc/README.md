# `src/drc` — design-rule check, connectivity, statistics

`spacing.ts` (task I2) finds every violating item pair per Sheet by querying the Lattice with
bounds expanded by half-width plus the largest spacing, then comparing exact Euclidean `dist2`
from `src/geom` against the SpacingTable entry for the pair's Kinds, Sheet and pair type, with the
same-net exemptions and special obstacles (Rim, holes, Fences) of `spec/rules/drc.md`.
`connect.ts` is union-find over copper contacts (Tarjan 1975) with `incompletes` = terminal
components − 1 per net (`spec/rules/connectivity.md`), and `requiredConnections` is Kruskal's
(1956) minimum spanning tree over components with deterministic ties. `stats.ts` produces the
`LayoutStats` vocabulary of `spec/api/contract.md`. This task fixes that vocabulary and the empty
results the API stubs return.
