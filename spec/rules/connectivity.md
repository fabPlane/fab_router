# Connectivity: what connects, connections, incompletes

Clauses `K-nn`. Observable through `checkDrc().incompletes`, `layoutStats().connections`,
`requiredConnections`, and `RouteReport.incompleteBefore/After`.

## The connection relation

Two items of the **same net** are *directly connected* when one of the following holds; the
relation is symmetric, and *connected* is its transitive closure within the net. Items of
different nets are never connected (overlap between them is a Violation, `spec/rules/drc.md`).
Items with no net connect to nothing.

**K-01 — copper overlap on a Sheet.** Two items whose copper shapes on the same Sheet overlap
or touch (Euclidean distance 0 between the shapes, boundary contact included) are directly
connected. This covers: a Track end inside a Pad's copper; a Track *passing through* a Pad's
copper (the CAD tool counts this, `Issue575-drc_Natural_Tone_Preamp_7_unconnected_items.dsn`,
net `Net-(U4-Pad22)`: a Track whose middle vertex is a Pad centre connects that Pad); a Track
end on another Track's body or end; a Track whose body crosses a same-net Barrel's copper
(`Issue575-drc_BBD_Mars-64_6_track_1_hole_clearance_violations.dsn`, net `/~{SPI_CE}`); two
Pads whose copper overlaps; a Barrel inside a Pad.

**K-02 — Barrels and through Pads join Sheets.** A Barrel (or a Pad with copper on several
Sheets) is one item: whatever it touches on any Sheet of its span is connected through it.

**K-03 — Pours connect what they overlap.** A Pour is copper of its net: every same-net item
whose copper overlaps the Pour's filled area (outline minus holes) on the Pour's Sheet is
connected to it, and two same-net Pours whose areas overlap on a Sheet are connected. **This is
the pour ruling** (see "Reference observations"): the CAD tool's DRC treats a pour as connecting,
and the spec follows the CAD tool.

**K-04 — plane Sheets.** A Pour on a plane Sheet follows K-03 like any Pour; because the
synthetic board-covering Pour of L-05 spans the whole board, every same-net Barrel or through
Pad reaching that Sheet is connected to it.

**K-05 — Pours are not obstacles.** Copper of *other* nets may overlap a Pour without
Violation, and the router may place Tracks and Barrels across Pours of other nets: the CAD tool
re-fills the pour around them with its own clearance. (Ruling: both references behave this way;
the alternative would forbid routing over any ground fill.) A Pour of a *different* net that
has `hold: "locked"` and is marked as an obstacle by an adapter (SRJ only) is the exception,
`spec/formats/srj.md`.

**K-06 — Fences and the Rim connect nothing** and belong to no net.

**K-07 — plane nets complete at the Pour.** For a plane net (L-06), a connection whose two
terminal components *both* contain a Pour is not attempted by the router (it would require a
Track on a plane Sheet or a detour the CAD tool does not want): it is still counted in
`incomplete` (K-09) and listed by `checkDrc`, but it is not counted in `RouteReport.attempted`
and its absence after routing is not a routing failure. A connection between a Pour-containing
component and a Pad-only component is routed like any other: it is complete as soon as the
Pad's component touches any Pour of the net (K-03), typically through a Barrel placed inside
the Pour (`planeViaCost`, `spec/api/settings.md`).

## Counting

**K-08 — components.** The *components* of a net are the equivalence classes of the connected
relation over the net's Pads, Barrels, Tracks and Pours. A Track or Barrel of the
net that touches nothing else (a dangling stub) is its own component **but is not counted**:
only components containing at least one Pad or Pour count as *terminal components*.

**K-09 — `connections.incomplete`.** For each net, `max(0, terminal components − 1)`; summed
over nets. `checkDrc().incompletes` lists one `Incomplete` per missing connection (K-11
chooses which pairs), `counts.incompletes` equals the sum. Nets in `StatsOptions.ignoreNetGroups`
groups are excluded (N-07).

**K-10 — `connections.maximum`.** For each net, `max(0, (number of Pads + number of Pours of the
net) − 1)`; summed over nets. It depends only on the file's Pads and Pours, so it is the same
before and after routing (the contract's "components − 1 at load" phrasing holds for a board
with no file wiring; this clause is the definition). Example: `Issue026-J2_reference.dsn` has
maximum 33 and, having no wiring, incomplete 33 at load; `cm5-carrier.dsn` has maximum 284
(both references agree on `maximum` for every board, since it ignores wiring).

**K-11 — which pairs are listed.** `requiredConnections(layout)` returns, per net, the edges of
a minimum spanning tree over the terminal components where the distance between two components
is the smallest Euclidean distance between a Pad centre (or Pour vertex, or Barrel centre) of
one and of the other; ties are broken by the lower item id pair. `Incomplete.airlineLu` is that
distance in LU. `checkDrc().incompletes` lists the same edges restricted to the still-unjoined
components. Implementations may list different but equally short edges only when distances tie.

**K-12 — routing targets.** A connection is *routed* when its two components become one under
K-01..K-07. The router's own inserted copper must satisfy K-01 exactly at joints: a Track it
adds ends inside the target Pad's copper, on the target Track's copper, or inside the Pour.
`RouteReport.incompleteAfter` is K-09 measured after routing; `completed` counts connections
that went from incomplete to routed.

## Reference observations and the pour ruling

The two references use an *endpoint* model: a Track connects to a Pad or Barrel only when one
of its end points equals the Pad/Barrel centre exactly, to another Track only end-to-end, and to
a Pour only when the end point lies inside the Pour polygon (reference B additionally counts a
Track end landing on the body of same-net copper, and overlapping same-net Pours). The CAD tool
exports pours with thermal-relief holes around the pads, so the pad centre is *outside* the
polygon and reference A sees pads as disconnected from the plane. Measured at load:

| Board | CAD tool (its own DRC report) | reference A | reference B | spec (K-01..K-10) |
|---|---|---|---|---|
| `Issue575-drc_Natural_Tone_Preamp_7_unconnected_items.dsn` | 7 unconnected | 145 | 8 | **7** |
| `Issue575-drc_BBD_Mars-64_6_track_1_hole_clearance_violations.dsn` | 0 unconnected | 3 | 1 | **0** |
| `Issue575-drc_dev-board_4_hole_clearance_violations.dsn` | 0 unconnected | 9 | 0 | **0** |

The spec numbers were checked against the CAD tool's report item by item: reference B's extra
airline on the preamp board is the through-pad Track of `Net-(U4-Pad22)` (K-01), its extra
airline on Mars-64 is the Barrel that `/~{SPI_CE}`'s front Track crosses mid-leg (K-01); both
are connected in the CAD tool and under K-01. Reference A's 145 on the preamp board are the
thermal-relief pads (K-03). **Ruling: the spec follows the CAD tool** — the board that leaves
the router goes back to the CAD tool, whose DRC decides whether the nets are complete; an
autorouter that reports 145 open connections on a board the CAD tool calls 7-open would route
copper the CAD tool then flags as redundant.

Consequence for the reference numbers in `spec/acceptance/reference/`: reference A's
`incompleteBefore`/`incompleteAfter` are inflated on boards with pours; S3 records them as
observed and applies this ruling when a case sets an `incomplete` expectation.

## SRJ inputs: what counts as a terminal (K-13..K-15)

These clauses specialise the counting above for a Layout built from a SimpleRouteJson document
(`spec/formats/srj.md`). They resolve Q-68.

**K-13 — required links come only from `pointsToConnect`.** For an SRJ connection with *k*
declared points, the required links are the `max(0, k − 1)` edges of a minimum spanning tree over
those points, exactly as K-11 chooses edges among terminal components. Each J802 connection has
two points, so it contributes one required link; a whole J802 board contributes 15.

**K-14 — pre-existing net-owned copper is attachable, not a terminal.** Copper an SRJ obstacle
declares as a connection's own copper (`spec/formats/srj.md` J-23) is same-net copper the router
may attach its routes to, but it is **not** an independent terminal component: it does not add to
`connections.maximum` or to `incomplete`, and it never creates a required link of its own. This
overrides, for SRJ-derived Layouts only, the general rule (K-08, K-10) that a Pour is a terminal
component — SRJ pre-existing copper stands in for wiring the board already has, and re-stitching
it would demand joins the board does not need. A connection is complete (K-12) as soon as its
declared points are electrically joined, whether directly or through the net-owned copper.

**K-15 — observed counts.** Run as a sealed program, the reference autorouter evaluates exactly
15 required connections on each J802 board (`b223-j802.srj.json`, and the six-layer
`b223-j802-six-layer{,-v2,-v3}.srj.json`), one per declared connection, never one per copper
fragment; reading each owned fragment as its own terminal would instead have yielded on the order
of 52 (two-layer) / 188 (six-layer). The spec follows the observed 15 (K-13, K-14). No Violation
is present before routing and none is added on any of the four boards.

**K-16 — completion by attachment (Q-69 ruling).** Prior copper is *connective*: a connection
completes (K-12) the moment its two declared points are joined to a common component, and a route
reaches that component either directly or by touching the net's Prior copper (K-01), which is
same-net copper the router attaches to for free (DR-02). This attachment is what lets completion
rise above zero on a board whose declared endpoints sit on different Sheets and are otherwise only
joined through the copper the board already carries. Prior copper thus wears two hats at once
without contradiction: an obstacle to other nets (`spec/rules/drc.md` DR-13) and connective helper
copper for its own net (this clause). It remains a non-terminal (K-14): attaching to it completes a
declared link but never adds one.

**Observed completion** (the sealed reference, 60 s budget; the six-layer boards under the
context-net import of `spec/formats/srj.md` J-25):

| Board | Sheets | Required | Complete | Incomplete after | Passes | Status |
|---|---|---|---|---|---|---|
| `b223-j802.srj.json` | 2 | 15 | 12 | **3** | 3 | ok |
| `b223-j802-six-layer.srj.json` | 6 | 15 | 0 | **15** | 1 | budget exhausted |
| `b223-j802-six-layer-v2.srj.json` | 6 | 15 | 9 | **6** | 3 | ok |
| `b223-j802-six-layer-v3.srj.json` | 6 | 15 | 9 | **6** | 3 | ok |

(`v2` and `v3` are byte-identical inputs; the six-layer v1 exhausts the budget on congestion, not
on any Violation.) A representation that models Prior copper as a keepout the router cannot attach
to leaves incomplete-after at 15 on every board, because each declared link would then need its two
endpoints joined end-to-end across Sheets without the board's own copper as a bridge; the observed
3 / 6 completion is reachable only when Prior copper is connective. These completion figures are
recorded per board in `spec/acceptance/reference/b223-j802*.srj.default.json` and are the
`incomplete` targets of the `srj-*` acceptance cases (`spec/formats/srj.md` §9).

## Detailed routing and shove outcomes (K-17..K-19)

These clauses state what a detailed-routing stage — one that places copper at finer resolution than
the coarse first search and may shove free items aside to make room (`glossary`) — must preserve.
They are written so that the acceptance runner and an implementer share one definition. Each is an
observation any run can check by comparing the Layout and `RouteReport` before and after; none
describes how such a stage works. They restate invariants R-1 and R-2 of `spec/api/contract.md`
for the detailed stage and extend R-2 to Prior copper.

**K-17 — a shove preserves each moved item's meaning.** A free Track or Barrel the stage displaces
to open room ("shoves") ends the run whole: it carries the same net it did before, the connection it
realises stays realised (no complete connection of K-09 becomes incomplete), and it is free of
Violations (`rules/drc.md`) — it and every pair it takes part in still meet the SpacingTable. Stated
observably: a shove adds no Violation (`violationsAdded` stays 0, R-1), and only a `free` item is
ever shoved.

**K-18 — held, locked and Prior copper never move.** Across a detailed-routing run the position,
shape, Sheet span and net of every `held` item, every `locked` item (Pads, Rim, Fences), and every
Prior-copper item (`glossary`; `rules/drc.md` DR-13) are identical before and after; an observer
comparing the two Layouts finds these items unchanged and only free items and the stage's own added
copper different. This is R-2 made specific to the detailed stage and extended to Prior copper:
Prior copper is same-net attachable copper (K-16) but is itself never rerouted or removed.

**K-19 — a detailed stage only completes, never regresses.** Enabling the detailed stage, with
everything else equal, never lowers `completed`, never turns a complete connection incomplete, and
never raises `violationsAdded` above 0: on a congested board it joins connections the coarse search
left incomplete, and on any board it leaves `completed`, `violationsAdded` and the held/locked/Prior
items no worse than with the stage off. The per-board connections that complete only with the stage
enabled, and the reference completion those targets are drawn from, are recorded in
`spec/behaviour/scenarios/detailed-routing.md` and `spec/behaviour/scenarios/shove.md`; the
generous-budget reference completion each dense board can actually reach is recorded in
`spec/acceptance/reference/<board>.bound.json` (and `.bound-fanout.json`) and named in the
`routing-*` and `srj-*` cases.
