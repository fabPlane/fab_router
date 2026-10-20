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
The single-track detour generator currently emits no paths for axial segments.
Complete deletion trials and repeat controls are under the c205 evidence assets.
