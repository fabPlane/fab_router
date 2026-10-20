# Single-segment native thermal regression

Exact frozen Aquarius J4 source board, with its MIT license and unchanged native
project/custom rules. Append `added.sexpr` before the board's final close.
The segment comes from placement-corrected engine `8fa7ead0`, seed 1.

Native 10.0.6 refill: source has zero errors and 110 opens; source plus the one
horizontal B.Cu segment has one starved thermal at GNDD U1.39 and 111 opens.
All source-connected terminal pairs remain connected. Removing the segment
restores the source result. Source geometry and authored zone rules are retained.

This is a reduction of the six-error benchmark failure, not a repaired route or
a globally minimized board. `full-added.sexpr.gz` contains all 466 added copper items from the full output,
six thermal errors, 15 opens and 348 lost source-connected terminal pairs.
The original single-track detour generator emits no paths for axial segments.
Complete deletion trials and repeat controls are under the c205 evidence assets.

`axial-input.kicad_pcb.gz` is the same source with only the second and third
occurrences of the duplicated Edge.Cuts graphical UUID replaced deterministically.
This fixture-only identity repair lets the strict proposal identity guard run;
no copper, outline geometry, pads, zones or rules change. The original frozen
input above is retained byte-for-byte. The axial search regression adds the same
signal segment. Its first detour reports zero errors and the 110-open source
budget without lost source/routed terminal pairs, but native loading reassigns
all three detour segments from `Net-(C1-Pad1)` to `Net-(R1-Pad1)`. It is UNSAFE.
The native ownership guard rejects it and the bounded search publishes nothing;
the prior report-only repair interpretation is withdrawn.

`connectivity-added.sexpr` reduces the separate source-connectivity blocker to
three added B.Cu signal segments (0.2032 mm, on three distinct nets). Together
they isolate GNDD U1.39 from the other 61 pads in its source-connected group after
native refill: one thermal error, 114 opens, 61 lost source pairs. Removing ANY
one of these three segments restores all source pairs (112 opens; thermal
errors vary). The full source geometry/rules remain unchanged; this is a
one-deletion-minimal added-copper witness, not a globally minimized board or a
route repair. The horizontal segment is also the earlier one-track thermal
witness: thermal starvation alone does not imply this terminal partition.
All 74 discovery/refill checks and three-repeat controls are retained in the
c207 evidence assets. No production behavior or scored outcome changes.

`connectivity-detour.sexpr` replaces the first horizontal track with the current
generator's first endpoint-preserving detour. Native 10.0.6 reports zero errors,
112 opens and zero lost source/routed pairs, but reassigns all three detour tracks
from `Net-(C1-Pad1)` to `Net-(R1-Pad1)` on refill. This is an UNSAFE diagnostic,
not a repair. The gate rejects both its native ownership change and its increase
above the 110-open source budget.
A separate load-only control isolates reassignment to native board loading,
before explicit connectivity build, refill, DRC or save.
The c208 evidence explicitly audits submitted versus native-saved ownership;
report/terminal counts alone must not be interpreted as proof of route fidelity.

The c210 narrow-offset diagnostic uses 0.060 mm endpoint-preserving 45-degree
ramps. It removes the thermal error and preserves native copper ownership and
source/routed terminal pairs, but retains 111 opens versus the source's 110.
The gate rejects it on the source open budget. This is DRC-clean local thermal
geometry, not a publishable repair or a complete-board routing improvement.

`backbone-added.sexpr` retains all nine generated copper items on the same signal
net from the full routed output. With this complete-net control, the same narrow
detour changes one thermal error to zero at 109 opens, preserves all source and
routed terminal pairs and native net ownership, and passes native acceptance.
Three fresh paired checks and one exact checked bundle are retained in c210.
Only the horizontal track changes; the other eight generated copper items and
all source geometry/rules remain intact. This is a manually constructed safe
local control, not automatic search recovery or a complete Aquarius fix.


The width-scaled generator regression extends this control: its first short
proposal for the offending track offsets by 0.30 × 0.2032 = 0.06096 mm. Native
acceptance reports zero new errors, 109 opens, no lost source/routed pairs and
unchanged copper ownership. The complete prior 90-proposal prefix cannot repair
this control. Short proposals are appended only within unused stage-budget slots;
the original isolated witness remains unpublishable. This is reduced-control
search coverage, not a complete Aquarius benchmark repair.
