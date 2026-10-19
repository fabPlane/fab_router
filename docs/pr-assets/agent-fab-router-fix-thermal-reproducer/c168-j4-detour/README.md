# A complete connected thermal-safe geometry witness

Replace the single causal J4 segment with two F.Cu segments through
(78.764, 109.855) mm. Both original endpoints, 0.250 mm width, net and layer
remain unchanged, as do the other 152 generated items and every original
board node and rule sidecar. This supplies a **static geometry witness** that
the thermal failure can be avoided without sacrificing the signal connection.
It does not implement a router fix, automatic candidate selection or rollback.

Same machine (`hyper-ms-lin`), cores 20–25, native 10.0.6, same complete route,
input/rules, three independent native refills and checks per variant:

| Variant | Native errors/run | Opens/run |
| --- | ---: | ---: |
| Original input | 0 | 55 |
| Complete route, original segment (before) | 1 thermal | 0 |
| Segment deleted | 0 | 1 |
| Upper-right right-angle detour (after) | **0** | **0** |
| Lower-left right-angle detour | 6 | 0 |
| Upper detour, 0.5 mm offset | 1 | 0 |
| Upper detour, 1.0 mm offset | 7 | 0 |
| Upper detour, 1.5 mm offset | 7 | 0 |
| Upper detour, 2.0 mm offset | 9 | 0 |

The original segment runs from (78.764, 112.108) to (76.073, 109.855) mm.
The clean detour goes vertically to (78.764, 109.855), then horizontally to
the original endpoint. The missing upper spoke of U2.15 returns and U2.14
remains connected. Other proposals demonstrate that an arbitrary bend is
insufficient: all candidates need whole-board native validation after refill.
No width or clearance relaxation, added thermal links or footprint/zone
changes are used. The detour is longer and has a 90-degree bend; no quality
or speed improvement is claimed.

All 27 measured saved boards preserve the proposal design signatures and
byte-identical rule sidecars. Complete error multisets and open counts repeat. Full open records are
retained, but native may choose either the B.Cu track or its touching via
as the disconnected component representative in the deletion control. The
verifier checks these two items share the same net, layer and endpoint;
U2.14 remains the other open endpoint. No exact open-record repeat claim is made. A separate one-repeat nine-check probe produced the same outcomes;
it is retained as `probe.tar.gz`, excluded from the table's repeat count.
The first command used a nonexistent input path and stopped before native
checks. An initial repeated run stopped because record ordering changed on
the rejected lower-left candidate; the complete finding multisets were equal.
A second partial run detected the equivalent open-endpoint variation
described above. The final run compares full error multisets (retaining
multiplicity) and open counts, with explicit deletion endpoint assertions.
Both partial runs are archived as `order-probe.tar.gz`; they are excluded
from the table and final 27-check totals. `native.tar.gz` retains all final proposals, saved boards, reports and
logs. `verify.py` reconstructs every proposal from the licensed earlier inputs,
checks hashes, original/unaffected copper and metadata, full findings, repeat
coverage and saved-design preservation. It checks recorded evidence without
authenticating the checker or rerunning native DRC.

Reproduce from repository root, using new output directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/j4-detour/input /tmp/j4-detour/routed /tmp/j4-detour/replay
gzip -dc "$R/c166-j4-causes/input.kicad_pcb.gz" > /tmp/j4-detour/input/input.kicad_pcb
cp "$R/c166-j4-causes/input.kicad_pro" "$R/c166-j4-causes/input.kicad_dru" /tmp/j4-detour/input/
gzip -dc "$R/qrpcard-auto-links/j4/source.kicad_pcb.gz" > /tmp/j4-detour/routed/source.kicad_pcb
cp "$R/qrpcard-auto-links/j4/source.kicad_pro" "$R/qrpcard-auto-links/j4/source.kicad_dru" /tmp/j4-detour/routed/
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 -B "$R/c168-j4-detour/measure.py" \
  --input /tmp/j4-detour/input/input.kicad_pcb \
  --routed /tmp/j4-detour/routed/source.kicad_pcb --out /tmp/j4-detour/fresh
tar -xzf "$R/c168-j4-detour/native.tar.gz" -C /tmp/j4-detour/replay
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$R/c168-j4-detour/verify.py" \
  --input /tmp/j4-detour/input/input.kicad_pcb \
  --routed /tmp/j4-detour/routed/source.kicad_pcb \
  --results /tmp/j4-detour/replay/native-final --out /tmp/j4-detour/findings.json
taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$R/c168-j4-detour/render.py" \
  --results /tmp/j4-detour/replay/native-final --out /tmp/j4-detour/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Native subprocesses each have a 120-second timeout. Engine/tests, adapter,
frozen inputs and checker are unchanged. Historical full routing benchmark
remains 39/78 passes, 13/26 valid 3/3, 120 opens and 27 thermal errors; it was
not rerun here. No production safety, scored improvement or live transaction
recovery is established. The next step is a native-aware routing policy that
can select and safely validate whole-route candidates.

![Actual native F.Cu geometry controls](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c168-j4-detour/comparison.png?raw=true)
