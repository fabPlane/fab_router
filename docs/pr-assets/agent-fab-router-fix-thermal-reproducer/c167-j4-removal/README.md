# Removing the isolated segment breaks the complete route

The previous J4 diagnostic showed one segment was sufficient to cause the
native thermal error on an otherwise intact original board. This control
checks its necessity in the **complete** measured route: remove exactly that
generated segment, retaining all other 152 generated copper items and every
original design node. This is a static diagnostic, not a production repair.

Same machine (`hyper-ms-lin`), cores 20–25, native 10.0.6, original input and
rules; three independent native refills/checks per variant:

| Variant | Generated items | Native errors/run | Opens/run |
| --- | ---: | ---: | ---: |
| Original input | 0 | 0 | 55 |
| Complete measured route (before) | 153 | 1 thermal | 0 |
| Complete route minus segment (after) | 152 | 0 | 1 |

Deleting segment `0798b683-fd93-4297-af4b-3f2365f20b8e` restores the missing
spoke at U2.15, but disconnects U2.14 on `Net-(LO(Q)1-Pad1)`. The native open
record pairs that pad with B.Cu track `9c9c7040-f0c6-4643-82bf-072cee572a5c`.
Complete native error and open records repeat identically across all three
runs. All nine saved boards preserve the proposed design signatures and
byte-identical rule sidecars. No saved-design drift was accepted.

The segment is both sufficient on the original input (previous diagnostic)
and necessary for the thermal error in this full route (this diagnostic).
Deletion alone is not a complete repair. This does not prove all alternative
route geometries fail, and no detour search or engine change is implemented.

`native.tar.gz` retains proposals, saved boards, full native reports and logs.
`verify.py` reconstructs proposals from the original and routed input, checks
all saved design nodes, hashes, sidecars, complete findings and repeat
coverage. It replays evidence, without authenticating reports or running DRC.
Inputs and their license remain in the earlier committed assets; measurement
summary records their hashes. The first invocation used a missing input path
and stopped before running any native checks; its empty directory is excluded.

Exact reproduction from repository root (new output directories required):

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/j4-removal/input /tmp/j4-removal/routed /tmp/j4-removal/replay
gzip -dc "$R/c166-j4-causes/input.kicad_pcb.gz" > /tmp/j4-removal/input/input.kicad_pcb
cp "$R/c166-j4-causes/input.kicad_pro" "$R/c166-j4-causes/input.kicad_dru" /tmp/j4-removal/input/
gzip -dc "$R/qrpcard-auto-links/j4/source.kicad_pcb.gz" > /tmp/j4-removal/routed/source.kicad_pcb
cp "$R/qrpcard-auto-links/j4/source.kicad_pro" "$R/qrpcard-auto-links/j4/source.kicad_dru" /tmp/j4-removal/routed/
taskset -c 20-25 nice -n 10 timeout 1500 /usr/bin/python3 -B "$R/c167-j4-removal/measure.py" \
  --input /tmp/j4-removal/input/input.kicad_pcb \
  --routed /tmp/j4-removal/routed/source.kicad_pcb --out /tmp/j4-removal/fresh
tar -xzf "$R/c167-j4-removal/native.tar.gz" -C /tmp/j4-removal/replay
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$R/c167-j4-removal/verify.py" \
  --input /tmp/j4-removal/input/input.kicad_pcb \
  --routed /tmp/j4-removal/routed/source.kicad_pcb \
  --results /tmp/j4-removal/replay/native-final --out /tmp/j4-removal/findings.json
taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$R/c167-j4-removal/render.py" \
  --results /tmp/j4-removal/replay/native-final --out /tmp/j4-removal/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Native subprocesses each have a 120-second timeout. Engine, tests, adapter and
frozen benchmark inputs/checker remain unchanged. Historical full routing
score remains 39/78 passes, 13/26 valid 3/3, 120 opens, 27 thermal errors;
no router benchmark was rerun and no routing improvement is claimed.

![Actual native F.Cu before and after removal](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c167-j4-removal/comparison.png?raw=true)
