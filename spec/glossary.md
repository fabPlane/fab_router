# Glossary and literature

## Vocabulary (binding)

| Term | Meaning |
|---|---|
| **Layout** | The board being routed: Stack, items, nets, rules |
| **Sheet** | One copper layer. Role `signal` (routable) or `plane` (a power/ground plane owned by one net) |
| **Stack** | The ordered Sheets, index 0 = the first copper layer in the file |
| **Frame** | Transform between file units and layout units (LU): scale and origin shift |
| **Layout unit (LU)** | The integer coordinate unit of a Layout; chosen per design so every coordinate satisfies \|coord\| ≤ 2^25 |
| **Part** | A placed footprint instance: reference designator, package, side (front/back), rotation |
| **PadForm** | A padstack definition: per-Sheet shapes, optional drill, attach-allowed flag |
| **Pad** | A Part pin's copper, instantiated from a PadForm; belongs to at most one net |
| **Barrel** | A via: a PadForm instance not owned by a Part, spanning a range of Sheets; through, blind (reaches one outer Sheet) or buried (reaches neither) |
| **Track** | A routed conductor: polyline centreline with a width, on one Sheet; its **legs** are its segments |
| **Pour** | A filled copper area or plane owned by a net; may have holes |
| **Fence** | A keepout region: scope `track`, `barrel`, or `place`; on one Sheet or all signal Sheets |
| **Rim** | The board outline (outer ring plus cut-outs) |
| **Net** | A set of Pads that must be connected; may be split into **subnets** by the file |
| **NetGroup** | A named group of nets carrying shared rules: track width, spacing Kind, via rule, usable Sheets |
| **Kind** | A clearance class name |
| **SpacingTable** | Required spacing for every (Kind, Kind, Sheet, pair type) |
| **Pair type** | The item-category pair a spacing applies to (`smd_smd`, `smd_via`, `via_via`, `pin_pin`, `wire_wire`, `wire_via`, …, `default`) |
| **Connection** | One required link between two connected components of a net (an edge of its minimum spanning tree) |
| **Incomplete** | A connection not yet realised by copper |
| **Violation** | A pair of items on a Sheet closer than the SpacingTable requires, or an item inside a Fence, a hole too close to copper, or copper too close to the Rim |
| **Router-added violation** | A violation present after routing that was not present before |
| **Hold** | Item mobility: `free` (router may rip or move), `held` (fixed by the file; obstacle), `locked` (Pads, Rim, Fences) |
| **Profile** | The rules resolved for one connection: width, spacing per Kind, allowed Sheets, Barrel forms, angle mode |
| **Lattice** | The spatial index |
| **Quilt / Patch / Seam** | The router's free-space decomposition / one free cell / the shared edge between two Patches |
| **Trail** | A candidate route before legalisation: legs per Sheet joined by Barrel drops |
| **Journal** | The mutation log with `mark` / `rewind` |
| **Pass** | One sweep of the router over every incomplete connection |
| **Fanout** | Giving an SMD Pad a short stub and a Barrel so its net can leave the Pad's Sheet |
| **Angle mode** | `90` (orthogonal legs only), `45` (orthogonal and diagonal), `any` |
| **Session** | The SPECCTRA SES file: the routed wiring to be imported back into the CAD tool |
| **Plane net** | A net named by a `plane` scope or by a plane Sheet's `use_net` list (`rules/layers.md` L-06); routes to its Pour count as complete and its Barrels cost `planeViaCost` |
| **Item category** | One of `track`, `barrel`, `pin` (multi-Sheet Pad), `smd` (single-Sheet Pad), `area` (Pour, Fence, Rim); each NetGroup maps every category to a Kind (`rules/clearance.md` C-11) |
| **Via rule** | A named, ordered list of PadForms a NetGroup may instantiate as Barrels (`rules/vias.md`) |
| **Via definition** | A network `via` entry: a name, a PadForm, a Kind and an attach flag; via rules are lists of these |
| **Attach** | Permission for a Barrel to sit inside a same-net SMD Pad (`rules/vias.md` V-08) |
| **Terminal component** | A connected component of a net that contains at least one Pad or Pour; `incomplete` counts terminal components − 1 per net (`rules/connectivity.md` K-08) |
| **Pour ruling** | The spec's decision that a Pour connects every same-net item it overlaps, following the CAD tool's DRC (`rules/connectivity.md`) |
| **Parse summary** | The normalised, reader-independent description of a board that `readDsn` must reproduce (`acceptance/parse/README.md`) |
| **Dangling** | A Track or Barrel connected to nothing of its net; never counted as a terminal component |
| **Prior copper** | Pre-existing net-owned copper carried in from an SRJ document's obstacles (`formats/srj.md` J-23): connective same-net copper the router may attach its routes to, an obstacle to router-added copper of every other net, never a connectivity terminal, and silent under design-rule checking against all other prior copper (same-net or not) — checked only against copper the router adds (`rules/drc.md` DR-13, `rules/connectivity.md` K-14/K-16) |
| **Turn gap** | The `smd_to_turn_gap` distance: how far a Track must leave an SMD Pad before its first bend (`rules/clearance.md` C-12) |
| **Shove** | Displacing an already-placed **free** Track or Barrel to open room for another route, then re-placing the displaced item so it stays whole (same net, connected as before) and design-rule-clean; a `held`, `locked`, or Prior-copper item is never shoved (`behaviour/scenarios/shove.md`, `rules/connectivity.md` detailed-routing outcomes) |
| **Detailed routing** | The stage that closes remaining Incompletes on a congested Layout by placing copper at finer resolution than a coarse first search, optionally shoving free items aside; judged only by its outcome — more connections whole, no held/locked/Prior item moved, no added Violation (`behaviour/scenarios/detailed-routing.md`) |
| **Congested region** | A part of a Sheet where the copper already placed leaves gaps near the minimum spacing, so a further route fits only if free items move or a finer path is found; named per board by the nets whose connections cross it |

## Literature (design from these; cite them in module headers)

- Lee, C. Y. (1961). *An algorithm for path connections and its applications.* IRE Trans. EC-10. — grid maze search.
- Soukup, J. (1978). *Fast maze router.* DAC. — depth-first line probing with fallback.
- Hart, P., Nilsson, N., Raphael, B. (1968). *A formal basis for the heuristic determination of minimum cost paths.* IEEE TSSC-4. — A\*.
- Nash, A., Daniel, K., Koenig, S., Felner, A. (2007). *Theta\*: any-angle path planning on grids.* AAAI. — string-pulling / line-of-sight shortcutting.
- Dees, W., Karger, P. (1982). *Automated rip-up and reroute techniques.* DAC.
- Hetzel, A. (1998). *A sequential detailed router for huge grid graphs.* DATE. — detailed routing that closes congestion gaps a coarse pass leaves.
- Cohoon, J. P., Heck, P. L. (1988). *BEAVER: a computational-geometry-based tool for switchbox routing.* IEEE TCAD-7. — gridless placement and displacement of wires in tight channels (shove).
- McMurchie, L., Ebeling, C. (1995). *PathFinder: a negotiation-based performance-driven router for FPGAs.* FPGA. — negotiated congestion / history cost.
- Dion, J., Monier, L. (1995). *Contour: a tile-based gridless router.* DEC WRL Research Report 95/3. — gridless tile decomposition of free space.
- Finkel, R., Bentley, J. (1974). *Quad trees: a data structure for retrieval on composite keys.* Acta Informatica 4. — adaptive quadtrees.
- Guttman, A. (1984). *R-trees: a dynamic index structure for spatial searching.* SIGMOD; Beckmann et al. (1990) *The R\*-tree.* — for contrast with the bucket grid.
- Andrew, A. M. (1979). *Another efficient algorithm for convex hulls in two dimensions.* IPL 9. — monotone chain.
- Hertel, S., Mehlhorn, K. (1983). *Fast triangulation of simple polygons.* FCT. — convex decomposition by diagonal removal.
- Shewchuk, J. R. (1997). *Adaptive precision floating-point arithmetic and fast robust geometric predicates.* — why exact orientation matters; here made exact by bounding coordinates.
- Kruskal, J. B. (1956). *On the shortest spanning subtree of a graph.* — required-connection MST.
- Tarjan, R. E. (1975). *Efficiency of a good but not linear set union algorithm.* — union-find for connectivity.
- Klarner, D. A. / "k-DOP" bounding volumes: Klosowski et al. (1998). *Efficient collision detection using bounding volume hierarchies of k-DOPs.* — the 8-DOP.
- Schleimer, S., Wilkerson, D., Aiken, A. (2003). *Winnowing: local algorithms for document fingerprinting.* SIGMOD. — the similarity gate.
- Ousterhout, J. K. (1984). *Corner stitching: a data-structuring technique for VLSI layout tools.* IEEE TCAD. — gridless free-space tiles.
- Hightower, D. W. (1969). *A solution to line-routing problems on the continuous plane.* Design Automation Workshop. — line-search routing.
- Mikami, K., Tabuchi, K. (1968). *A computer program for optimal routing of printed circuit conductors.* IFIP. — line-search routing.
- Dai, W. W.-M., Kong, R., Jue, J., Sato, M. (1991). *Rubber band routing and dynamic data representation.* ICCAD; Dai, Kong, Sato (1991), *Routability of a rubber-band sketch,* DAC. — shove / rubber-band routing.
- Nair, R. (1987). *A simple yet effective technique for global wiring.* IEEE TCAD. — net ordering by difficulty.
- Chu, C., Wong, Y.-C. (2008). *FLUTE: fast lookup table based rectilinear Steiner minimal tree algorithm.* IEEE TCAD. — congestion-aware net decomposition.
- Hwang, F. K. (1976). *On Steiner minimal trees with rectilinear distance.* SIAM J. Appl. Math.
- Kastner, R., Bozorgzadeh, E., Sarrafzadeh, M. (2002). *Pattern routing / predictable routing (Labyrinth).* ICCAD. — negotiated global routing.
- Pan, M., Xu, Z., Chu, C. (2006–2009). *FastRoute 1.0–4.0.* ICCAD/ASP-DAC. — congestion-driven Steiner, edge shifting, monotonic routing, layer assignment.
- Cho, M., Pan, D. Z. (2006–2007). *BoxRouter / BoxRouter 2.0.* DAC/ICCAD. — global routing and layer assignment.
- Gao, J.-R., Wu, P.-C., Wang, T.-C. (2008). *NTHU-Route.* ICCAD. — modern negotiation-based global router.
- Albrecht, C. (2001). *Global routing by new approximation algorithms for multicommodity flow.* IEEE TCAD.
- **SPECCTRA Design Language Reference** (Cadence, v10.1, 2003) — the DSN/SES/rules formats.
