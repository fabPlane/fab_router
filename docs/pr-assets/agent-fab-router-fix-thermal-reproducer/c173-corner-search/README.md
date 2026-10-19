# Connected two-track thermal corner search

The previous complete J2-small search cleared U2.15 but left U1.7's thermal
error. Its causal generated tracks share a corner; changing either track
independently was insufficient. This offline diagnostic moves their shared
corner together, preserves the outer endpoints, width, layer and net, and
reuses the native error-subset, saved-design and terminal-connectivity gates.
It requires the already isolated generated pair; it does not discover pairs.

Same complete intermediate board, rules, machine (`hyper-ms-lin`), cores
20–25, native 10.0.6; three independent repeats:

| Variant | Native errors/run | Opens/run | Repeats |
| --- | ---: | ---: | ---: |
| Before corner search | 1 thermal | 0 | 3 |
| After corner search | 0 | 0 | 3 |

The thirteenth proposal moves the corner from (81.014, 130.108) to
(83.014, 130.108) mm. Both outer endpoints remain (81.764, 133.108) and
(80.264, 130.108) mm. The first twelve proposals are rejected; every failed
transaction preserves exact input bytes. Each repeat checks one baseline and
13 proposals. All original design nodes survive, other generated copper is
unchanged, and terminal partitions are verified against saved native boards.
Two geometry tests cover endpoint preservation and exclusion of zero-length
tracks. Their initial missing-module failure is new-tool coverage, **not** an
engine regression test. An initial test fixture accidentally placed its outer
endpoint on a proposed corner; correcting that fixture leaves the separate
zero-length exclusion test in place.

This is a connected native-clean witness and an offline search improvement,
not a production routing fix, native editor rollback proof or scored router
run. Pair discovery and safe production integration remain unimplemented.
The full historical suite remains 39/78 passing runs, 13/26 valid cases,
120 opens and 27 new thermal errors; it was not rerun. No engine, adapter,
frozen input, checker or performance routing functions changed.
Inputs and licensing derive from `../c165-thermal-causes/`; the source is
cycle 172's validated first-stage output. Native warnings are retained in logs.

Reproduce from the repository root (fresh directories):

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/corner-search
tar -xzf "$R/c173-corner-search/native.tar.gz" -C /tmp/corner-search
/usr/bin/python3 -B "$R/c173-corner-search/verify.py" --results /tmp/corner-search
/usr/bin/python3 -B - <<'PY'
import json
from pathlib import Path
s=Path('/tmp/corner-search')
z=json.loads((s/'native/summary.json').read_text())
for role in ('stage2-source','original-input'):
    d=s/role;d.mkdir(exist_ok=True)
    for name,digest in z['source_sha256'].items():
        if role in name:
            (d/('board'+Path(name).suffix)).write_bytes((s/'native/sources'/digest).read_bytes())
PY
/usr/bin/python3 -B "$R/c173-corner-search/test_corner.py"
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/c173-corner-search/corner.py" \
  --source /tmp/corner-search/stage2-source/board.kicad_pcb \
  --input /tmp/corner-search/original-input/board.kicad_pcb \
  --segments 3837e144-04ed-4677-a7ac-4e5609108771 debd372e-2f77-4d2d-aa40-6dd5243a7732 \
  --out /tmp/corner-search/fresh
/usr/bin/python3 -B "$R/c173-corner-search/render.py" --results /tmp/corner-search --out /tmp/corner-search/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native corner search](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c173-corner-search/comparison.png?raw=true)
