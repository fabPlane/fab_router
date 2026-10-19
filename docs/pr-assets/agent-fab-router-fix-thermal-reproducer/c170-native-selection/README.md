# Native selection of a complete-board detour

The isolated generated J4 segment blocks U2.15's upper thermal spoke. This
experiment replaces it with the first acceptable geometry-derived chamfer.
Unlike the earlier fixed-geometry sweep, selection now queries the complete
native board and requires a strict subset of errors, no lost terminal pair,
unchanged terminal inventory, no increase in opens, and no saved-design drift.

Same board and host, cores 20–25, native 10.0.6, three independent repeats:

| Variant | Native errors/run | Opens/run | Accepted | Repeats |
| --- | ---: | ---: | ---: | ---: |
| Complete route before | 1 thermal | 0 | — | 3 |
| Deletion control | 0 | 1 | 0/3 | 3 |
| Automatically selected detour | 0 | 0 | 3/3 | 3 |

The search tries at most six proposals: two orthogonal bend orientations and
three chamfer radii derived from endpoint separation. It takes an explicitly
isolated generated segment UUID; it does not discover causes. The first
proposal succeeds here, identically three times. All 152 unaffected generated
items and all other source design nodes are preserved. Native terminal
partitions are identical. Deletion rejects and returns the exact source bytes.
Every source board and rule sidecar remains byte-identical throughout.

This is an offline search experiment, not an engine fix or live-editor recovery
primitive. No full routing benchmark was run. Historical scoring remains
39/78 passes, 13/26 valid cases, 120 opens and 27 thermal errors. No production
thermal safety, general routing improvement, or speed claim is established.
The search reuses the earlier native transaction validator and its 120-second
subprocess timeout. Checker failures remain explicit in attempt records.

Reproduce from the repository root, using fresh output directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/native-selection/replay
tar -xzf "$R/c170-native-selection/native.tar.gz" -C /tmp/native-selection/replay
/usr/bin/python3 -B "$R/c170-native-selection/verify.py" --results /tmp/native-selection/replay/final-native
# Archived source inputs are named by SHA-256; stage board sidecars for a fresh run:
/usr/bin/python3 -B - <<'PY'
import json
from pathlib import Path
r=Path('/tmp/native-selection/replay/final-native')
z=json.loads((r/'summary.json').read_text())
for role, marker in [('source','0-original-segment'),('input','0-original-input')]:
    d=Path('/tmp/native-selection')/role
    d.mkdir(exist_ok=True)
    for path,digest in z['source_sha256'].items():
        if marker in path:
            (d/('board'+Path(path).suffix)).write_bytes((r/'sources'/digest).read_bytes())
PY
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/c170-native-selection/search.py" --source /tmp/native-selection/source/board.kicad_pcb --input /tmp/native-selection/input/board.kicad_pcb --segment 0798b683-fd93-4297-af4b-3f2365f20b8e --out /tmp/native-selection/fresh
/usr/bin/python3 -B "$R/c170-native-selection/test_search.py"
/usr/bin/python3 -B "$R/c170-native-selection/render.py" --results /tmp/native-selection/replay/final-native --out /tmp/native-selection/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Three geometry tests cover all endpoint quadrants, axis-aligned exclusions,
continuity, deterministic proposals, and preserved width/net/layer. They were
written before the new search module (initial failure: missing module), so
this is new tool coverage, not a reproduced engine regression. The retained
native run has nine checks. The earlier six-check exploration and pre-packaging nine-check run are excluded.
Input licensing remains in the parent evidence directory.

![Measured native selection](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c170-native-selection/comparison.png?raw=true)
