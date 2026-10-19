# One-segment native thermal witness on the fully routed input

The measured qrpcard J4 seed-3 route adds 115 segments and 38 vias to an
original board with no retained tracks. Adding just one of those segments to
the intact original input reproduces its thermal error at ground pad U2.15.
All 33 footprints, two zone definitions, outline, setup and native rule
sidecars remain unchanged. The board license is retained alongside the input.
This is a static native diagnostic, not a production fix or routing score gain.

Same machine (`hyper-ms-lin`), cores 20–25, native 10.0.6, rules and inputs;
three independent refills/checks of each control:

| Input variant | Added items | Native errors/run | Opens/run |
| --- | ---: | ---: | ---: |
| Original (before) | 0 | 0 | 55 |
| Isolated segment (after) | 1 | 1 thermal at U2.15 | 55 |
| Isolated segment removed | 0 | 0 | 55 |
| Complete measured route | 153 | 1 thermal at U2.15 | 0 |

Segment `0798b683-fd93-4297-af4b-3f2365f20b8e` runs from
(78.764, 112.108) to (76.073, 109.855) mm, on F.Cu, width 0.250 mm,
net `Net-(LO(Q)1-Pad1)`. The complete native error record identifies U2.15
`d77f2098-e7f4-4d9b-a0ff-0f4972d0cb00`: two spokes required, one found.
The crop shows the added segment clearance removing the upper spoke.
No clearance/width relaxation or source policy is implemented.

The adaptive reduction first tries segments without vias, then bisects and
tries complements. It completed 24 checks, including 12 repeated controls,
with **zero saved-design drifts**. Every proposal is the original parsed tree
plus selected route nodes. One segment is a cardinality minimum for a nonempty
addition witness because the empty control has no error. This is not a minimal
PCB: all original footprints/zones/rules remain. Other singletons were not
exhaustively tested. Removing this segment from the complete routed output was
not tested and is not proposed as a repair.

`verify.py` independently reconstructs all proposals, compares saved design
signatures and sidecars, checks full native error records and repeat coverage,
and verifies the removal control. It replays retained evidence; it does not
authenticate reports or rerun the checker. An initial 26-check exploratory
reduction encountered via-related saved-design drift and was stopped; it is
retained privately and excluded from all published totals. The completed run
uses the segments-first schedule shown here.

Reproduce from the repository root (new output directories required):

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c166-j4-causes
P=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/qrpcard-auto-links/j4
mkdir -p /tmp/j4-thermal/input /tmp/j4-thermal/routed /tmp/j4-thermal/replay
gzip -dc "$R/input.kicad_pcb.gz" > /tmp/j4-thermal/input/input.kicad_pcb
cp "$R/input.kicad_pro" "$R/input.kicad_dru" /tmp/j4-thermal/input/
gzip -dc "$P/source.kicad_pcb.gz" > /tmp/j4-thermal/routed/source.kicad_pcb
cp "$P/source.kicad_pro" "$P/source.kicad_dru" /tmp/j4-thermal/routed/
taskset -c 20-25 nice -n 10 timeout 3600 /usr/bin/python3 -B "$R/reduce.py" \
  --input /tmp/j4-thermal/input/input.kicad_pcb \
  --routed /tmp/j4-thermal/routed/source.kicad_pcb --out /tmp/j4-thermal/fresh
tar -xzf "$R/native.tar.gz" -C /tmp/j4-thermal/replay
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$R/verify.py" \
  --input /tmp/j4-thermal/input/input.kicad_pcb \
  --results /tmp/j4-thermal/replay/native-final --out /tmp/j4-thermal/findings.json
taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$R/render.py" \
  --results /tmp/j4-thermal/replay/native-final --out /tmp/j4-thermal/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Each native subprocess has a 120-second timeout. Engine/test files and frozen
benchmark inputs/checker remain unchanged. The prior full routing score remains
39/78 passes, 13/26 valid 3/3, 120 opens and 27 thermal errors; it was not rerun
here. No native thermal safety or routing improvement is claimed.

![Actual native F.Cu thermal witness](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c166-j4-causes/comparison.png?raw=true)
