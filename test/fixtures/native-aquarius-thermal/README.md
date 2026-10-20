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
signal segment, then restores the thermal and 110-open source budget without
losing either source-connected or routed-connected terminal pairs.
