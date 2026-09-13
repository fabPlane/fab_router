# Design-rule checking: Violations

Clauses `DR-nn`. Observable through `checkDrc()`, `layoutStats().violations`,
`RouteReport.violationsBefore/Added` and invariant R-1 of `spec/api/contract.md`.

## What a Violation is

**DR-01 — spacing.** Two items A and B are in *spacing violation* on Sheet s when all of:
both have copper on s; they do not share a net (an item with `net: null` shares no net with
anything; a net tie item carrying several nets shares a net with anything carrying one of them);
neither carries Kind `null`; the pair is a checked pair (DR-03); and the Euclidean distance
between their copper shapes on s is **strictly less** than `spacing.get(kind(A), kind(B), s)`.
Distance exactly equal to the required spacing is not a violation. Overlapping copper has
distance 0. The Violation reports `rule: "spacing"`, `required` (the table value in LU),
`actual` (the measured distance in LU), and `at` (a point in the gap or overlap).

**DR-02 — same-net copper is never a spacing violation.** This includes a Barrel placed at the
centre of a same-net plated Pad (test points on
`Issue575-drc_BBD_Mars-64_6_track_1_hole_clearance_violations.dsn`, 64 of them), two coincident
same-net SMD Pads (`Issue575-drc_dev-board_4_hole_clearance_violations.dsn`, U2), and Tracks
that overlap same-net Pads or Tracks. Ruling: both references count the first two as
violations (76 and 2 respectively); the CAD tool counts neither; and R-1 must not be tripped by
the router legitimately dropping a Barrel into a same-net Pad or joining a Track to one.

**DR-03 — checked pairs.**

| A \ B | Pad | Barrel | Track | Pour | Fence (track) | Fence (barrel) | Rim |
|---|---|---|---|---|---|---|---|
| Pad | spacing | spacing | spacing | — | fence | — | rim |
| Barrel | spacing | spacing | spacing | — | fence | fence | rim |
| Track | spacing | spacing | spacing | — | fence | — | rim |
| Pour | — | — | — | — | — | — | — |

Pours are never part of a Violation (K-05). Fences of scope `place` and Fence–Fence pairs are
never checked. `fence` means: the item's copper on the Fence's Sheet comes closer to the Fence
shape than `spacing(kind(Fence), kind(item))` (Kind `null` on the Fence → the copper must merely
not overlap the Fence; rule `"fence"`, `b: "fence"`). `rim` means: the item's copper on any Sheet
comes closer to the Rim's outline or cut-out polylines (zero-width lines) than
`spacing(kind(Rim), kind(item))` (rule `"rim"`, `b: "rim"`). A Pad or Barrel is checked on every Sheet of its span; a Track on its
Sheet; each Track leg separately but a Track–Track pair is still one Violation per Sheet.

**DR-04 — counting.** `violations.total` counts each unordered item pair once per Sheet
(A–B on s and B–A on s are the same Violation); a pair violating on two Sheets counts twice.
`violations.byRule` splits the total by `rule` (`spacing`, `rim`, `fence`, `hole`).

**DR-05 — pre-existing violations.** Whatever the file contains is checked as-is: held or locked
Tracks too close to Pads, Pads too close to the Rim, Pads inside Fences. `violationsBefore` is
`checkDrc` on the Layout as read (after `applyRules` and after the settings of C-15 when the run
sets them); the router must never remove file items to "fix" them (R-2).

**DR-06 — hole clearance.** With `holeClearanceUm` > 0 (C-15): for every Pad or Barrel with a
drill, the drill circle enlarged by the clearance must not intersect other-net copper (Pads,
Barrels, Tracks) on any Sheet of the board; a hit is one Violation with `rule: "hole"`,
`b: "hole"`, `required` = the clearance in LU, `actual` = the distance from the drill edge.
Non-plated holes are Fences (KO-07) and are covered by the `fence` rule with the `hole_edge`
Kind. Without the setting no `hole` Violations exist.

**DR-07 — geometry is exact.** Distances are Euclidean between the true copper shapes: disks,
rounded rectangles, capsules (stroked Track legs with round ends), polygons. An implementation
may test with a conservative approximation first but must confirm every reported Violation with
the exact distance (a Violation must not be reported when the exact distance is ≥ required, and
must be reported when it is <). The references measure with an octagonal approximation of the
enlarged shapes; on the corpus boards this changes no count listed below.

## The invariants

**DR-08 — the router never adds a Violation (R-1).** `violationsAdded = violationsAfter −
violationsBefore` must be 0 for every run on every board at every setting. Every Track leg and
Barrel the router inserts is checked against every checked pair of DR-03 with the spacing of
the connection's Profile before it is committed; Track joints to same-net copper are exempt
(DR-02). When a pre-existing violation makes it impossible to place copper that is clear of
everything (a Pad that already sits inside a Fence, say), the connection stays incomplete rather
than adding a Violation.

**DR-09 — `strictDrc`.** Off (default): the router relies on the checks it makes while
constructing each Trail (DR-08). On: additionally, after each connection is inserted, the
newly inserted items are re-checked with the full `checkDrc` semantics (every checked pair of
DR-03, exact geometry); if any Violation involves a new item, **all** items inserted for that
connection are removed and the connection is counted as failed for that pass. Because R-1 holds
in both modes, `violationsAdded` is 0 either way; `strictDrc` can only lower completion (and
costs time), never change what DRC counts. The corpus board for the strict case is
`Issue555-CNH_Functional_Tester_1.dsn`: 16 pre-existing violations (all Pad–Pad or Track–Pad,
required 635.2 µm — the power classes' `(clearance 635.1)` after C-04 and C-08 — with 8 of the 16 at exactly 635.1 µm, so a
reader that skipped the even rounding would report 8), which must still be exactly 16 after a
strict run.

**DR-10 — `checkDrc` is pure.** It changes nothing on the Layout, is deterministic, and
returns the same counts whether or not a route has run, for the same Layout state.

## Load-time numbers for the boards with CAD-tool DRC reports

Three corpus boards come with the CAD tool's own DRC report (`*-kicad_drc.json`) and with
reference A's report (`*-refA_drc.json`). Counts at load, file rules only (no
`copperToEdgeClearanceUm`, no `holeClearanceUm`):

| Board | CAD tool report | reference A | reference B | spec `violations.total` | spec `incomplete` |
|---|---|---|---|---|---|
| `Issue575-drc_BBD_Mars-64_6_track_1_hole_clearance_violations.dsn` | 6 clearance + 1 hole clearance (17 dangling vias not counted) | 76 | 76 | **12** | **0** |
| `Issue575-drc_Natural_Tone_Preamp_7_unconnected_items.dsn` | 0 | 0 | 0 | **0** | **7** |
| `Issue575-drc_dev-board_4_hole_clearance_violations.dsn` | 4 hole clearance | 2 | 0 | **0** | **0** |

How the spec numbers follow from the clauses:

- Mars-64: the references' 76 are 64 same-net Barrel-in-Pad pairs (DR-02: not violations) plus
  9 Track–Track pairs of different nets at 199.8–199.9 µm against a required 200 µm (DR-01:
  violations; the legs are axis-parallel or diagonal so the exact distance equals the
  references' measurement) plus 3 Track–Fence pairs (a Track crossing the mounting-hole Fence
  of `H4`, actual 0, and two Tracks 68.3 µm and 75.9 µm from a hole Fence; DR-03 `fence`):
  9 + 3 = **12**, `byRule: { spacing: 9, fence: 3 }`. The CAD tool's 6 clearance findings are
  pad-to-footprint-graphic-polygon pairs; those polygons are not exported to the DSN, so no
  DSN reader can see them. Its 1 hole-clearance finding (0.2105 mm from an NPTH against its 0.25
  mm board rule) is the `H4` Track–Fence pair above, counted once.
- Preamp: nothing is closer than the rules on this board in any model; the 7 incompletes are
  K-01..K-10 (`spec/rules/connectivity.md`).
- dev-board: reference A's 2 are coincident same-net SMD Pads (DR-02). The CAD tool's 4 hole
  clearance findings are Pads 0.2001/0.2349 mm from NPTH edges against a 0.25 mm rule that
  exists only in the CAD tool's project, not in the DSN (the DSN's clearance is 0.2 mm and its
  NPTH Fences are the hole outline itself). With `holeClearanceUm: 250` those four Pad–Fence
  pairs become `fence` Violations under C-15/KO-07 — a `drc-load` case with that setting may
  expect **4**.

`cm5-carrier.dsn` at load (reference B, file rules): 25 spacing violations — 14 Pad–Rim (2 at
20.1 µm and 12 at 140.1 µm from the outline against 200 µm required) and 11 Pad–Pad
(1 at 125.1 µm, 10 at 199.5 µm against 200 µm). Under DR-03 with a zero-width Rim line the 14
Pad–Rim distances are the same (the reference measures to a 10 µm-wide outline stroke; every
one of these is ≥ 60 µm inside the limit), so the spec count is **25**, `byRule: { rim: 14,
spacing: 11 }`.

## Reference observations

On the boards examined here (the three DRC-report boards and the CNH tester) references A and B
report identical violation totals except on
`Issue575-drc_dev-board_4_hole_clearance_violations.dsn` (A 2, B 0: B exempts coincident
same-net SMD Pads, A does not); S3's `reference/*.json` files carry both references'
`violationsBefore` for every board. Both count same-net Barrel-in-Pad pairs as violations; the spec
does not (DR-02). Both treat a Pad with no net as an obstacle to every net (DR-01). Neither
applies copper-to-edge or hole clearance unless the run's settings set them; the spec defaults
are in `spec/api/settings.md`.

**DR-11 — copper stays on the board.** Every Track leg and Barrel added by the router must lie
entirely inside the Rim's outer ring and outside its cut-outs (touching the outline counts as
outside once the copper-to-edge spacing is applied). A leg or Barrel that is not is a violation of
rule `rim`, whether or not it is near an outline segment. (Ruling Q-I3-23.)

**DR-06a — hole clearance scope (ruling Q-I3-20).** The enlarged drill circle of DR-06 is checked
on every Sheet within the drill's span (all Sheets for a through drill) against other-net copper,
and against every other-net drill (drill-to-drill distance ≥ the hole clearance) regardless of
Sheet. DRC and the router apply the same rule.
