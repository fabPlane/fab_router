# Native source-zone connectivity regression

Derived from the frozen hellscribe J2large seed-1 board routed by engine `8fa7ead0`.
The original public-domain board license is retained in LICENSE.
`input.kicad_pcb.gz` is the exact retained source; sidecars are unchanged.
Insert either added scope file immediately before the input board's final `)`.
`full-added.sexpr.gz` contains all 135 generated tracks/vias; native opens fall
14 → 1 with zero errors, but U2.8 loses 17 ground-pad connections.
`reduced-added.sexpr` contains 4 added items and reproduces the same
17 lost pairs. Source geometry, pads, retained copper and authored zones remain.
This is a diagnostic, not a repaired route. Full trial evidence and limits live
under docs/pr-assets/agent-fab-router-native-drc-gate/c199-real-zone-split/.
