# Marker-guided complete-board candidate search

This extends the offline selector to discover candidate generated segments from
native thermal pad markers. Zone anchor positions are excluded by matching
marker UUIDs to actual footprint pads. Tracks are ordered by clamped point-to-
segment distance, then UUID. Original track UUIDs are excluded. At most eight
tracks and six chamfers per track are considered. A nearby track is a candidate,
not a proven cause; every proposal still requires complete-board native validation.

Same complete J4 board, same host, cores 20–25, three independent repeats:

| Variant | Thermal errors/run | Opens/run | Repeats |
| --- | ---: | ---: | ---: |
| Complete route before | 1 | 0 | 3 |
| Marker-guided selection | 0 | 0 | 3 |

The first ranked segment and first chamfer succeeded identically three times,
without a manually supplied segment UUID. Terminal partitions are identical,
source board/rule bytes remain unchanged, and saved design signatures match
proposals. Six native checks are archived. One ranking regression failed first
(missing rank function), then passed. This is new diagnostic coverage, not an
engine regression fix. It covers original-track exclusion, zone-anchor exclusion,
bounded ranking and unrelated marker rejection. Earlier geometry tests apply to
the inherited proposal generator.

No production engine or editor integration, full benchmark gain, general thermal
repair or speed claim. Historical suite results remain 39/78 passes, 13/26 valid
cases, 120 opens, 27 new thermal errors. Multi-track causes and failed candidate
sets remain unresolved. Input licensing is retained in the parent directory.

Reproduce from repository root (fresh output directory):

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/marker-search
tar -xzf "$R/c171-marker-search/native.tar.gz" -C /tmp/marker-search
/usr/bin/python3 -B "$R/c171-marker-search/verify.py" --results /tmp/marker-search/native
/usr/bin/python3 -B - <<'PY'
import json
from pathlib import Path
r=Path('/tmp/marker-search/native')
z=json.loads((r/'summary.json').read_text())
for role,marker in [('source','original-segment'),('input','original-input')]:
    d=Path('/tmp/marker-search')/role
    d.mkdir(exist_ok=True)
    for name,digest in z['source_sha256'].items():
        if marker in name:
            (d/('board'+Path(name).suffix)).write_bytes((r/'sources'/digest).read_bytes())
PY
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/c171-marker-search/search.py" --source /tmp/marker-search/source/board.kicad_pcb --input /tmp/marker-search/input/board.kicad_pcb --out /tmp/marker-search/fresh
/usr/bin/python3 -B "$R/c171-marker-search/test_rank.py"
/usr/bin/python3 -B "$R/c171-marker-search/render.py" --results /tmp/marker-search/native --out /tmp/marker-search/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Measured marker-guided selection](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c171-marker-search/comparison.png?raw=true)

Required checks: typecheck and layer checks pass; 859 engine tests pass, zero failures (398454 assertions, 223.56 seconds). Ranking and three inherited geometry tests pass; archive replay passes.
