# Connected 45-degree thermal-safe witnesses

The complete J4 route loses the upper thermal spoke at U2.15. Replacing only
its isolated causal segment with a chamfered detour restores that spoke while
keeping U2.14 connected. This extends the earlier right-angle witness to six
45-degree geometries; it is a static diagnostic, not a production fix.

Same complete route, machine `hyper-ms-lin`, cores 20–25, native 10.0.6,
three independent refills/checks per variant:

| Variant | Native errors/run | Opens/run | Repeats |
| --- | ---: | ---: | ---: |
| Original input | 0 | 55 | 3 |
| Complete route before | 1 thermal | 0 | 3 |
| Causal segment deleted | 0 | 1 | 3 |
| Right-angle detour control | 0 | 0 | 3 |
| Chamfer 0.125 mm | 0 | 0 | 3 |
| Chamfer 0.25 mm | 0 | 0 | 3 |
| Chamfer 0.5 mm | 0 | 0 | 3 |
| Chamfer 1.0 mm | 0 | 0 | 3 |
| Chamfer 1.5 mm | 0 | 0 | 3 |
| Chamfer 2.0 mm | 0 | 0 | 3 |

The bend at (78.764,109.855) mm is trimmed by the stated distance along each
axis, introducing one 45-degree segment. Width, layer, net and endpoints
are preserved. All other 152 generated items, original board nodes and rule
sidecars remain unchanged. All 30 saved designs match their proposals;
complete error multisets and open counts repeat. Full native reports, saved
boards and proposals are in `native.tar.gz`. `verify.py` reconstructs each
proposal and checks the archived evidence; it does not rerun native DRC.
The sweep and verifier reuse the earlier diagnostic helpers, including their
explicit handling of equivalent open-endpoint representatives.

Reproduce from repository root (use fresh output directories):

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/j4-chamfer/input /tmp/j4-chamfer/routed /tmp/j4-chamfer/replay
gzip -dc "$R/c166-j4-causes/input.kicad_pcb.gz" > /tmp/j4-chamfer/input/input.kicad_pcb
cp "$R/c166-j4-causes/input.kicad_pro" "$R/c166-j4-causes/input.kicad_dru" /tmp/j4-chamfer/input/
gzip -dc "$R/qrpcard-auto-links/j4/source.kicad_pcb.gz" > /tmp/j4-chamfer/routed/source.kicad_pcb
cp "$R/qrpcard-auto-links/j4/source.kicad_pro" "$R/qrpcard-auto-links/j4/source.kicad_dru" /tmp/j4-chamfer/routed/
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 -B "$R/c169-j4-chamfer/measure.py" --input /tmp/j4-chamfer/input/input.kicad_pcb --routed /tmp/j4-chamfer/routed/source.kicad_pcb --out /tmp/j4-chamfer/fresh
tar -xzf "$R/c169-j4-chamfer/native.tar.gz" -C /tmp/j4-chamfer/replay
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$R/c169-j4-chamfer/verify.py" --input /tmp/j4-chamfer/input/input.kicad_pcb --routed /tmp/j4-chamfer/routed/source.kicad_pcb --results /tmp/j4-chamfer/replay/native --out /tmp/j4-chamfer/findings.json
taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$R/c169-j4-chamfer/render.py" --results /tmp/j4-chamfer/replay/native --out /tmp/j4-chamfer/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Each native subprocess has a 120-second timeout. Engine/tests, adapter,
frozen inputs and checker are unchanged. No full router benchmark was run;
historical results remain 39/78 passes, 13/26 valid cases, 120 opens and 27
thermal errors. These longer paths do not establish general candidate
selection, native transaction recovery, routing quality or a scored gain.
Next: native-aware whole-route candidate selection with safe recovery.

![Native chamfer comparison](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c169-j4-chamfer/comparison.png?raw=true)
