# Bounded search on the complete two-error route

The unchanged marker-guided selector from `../c171-marker-search/search.py`
was measured on the complete J2-small board with all nine generated copper
items added to the intact original input. Unlike raw session import, this
source preserves all original copper UUIDs, so the selector's original-item
exclusion remains valid. Inputs and licensing derive from
`../c165-thermal-causes/`; its native saved `1-all-added` board is the first
stage's source. Each stage uses the original input for retained-item exclusion.

Same machine (`hyper-ms-lin`), cores 20–25, native 10.0.6, same board/rules,
three independent repeats per stage:

| Variant | Thermal errors/run | Opens/run | Repeats |
| --- | ---: | ---: | ---: |
| Complete route before | 2 | 0 | 3 |
| After first search | 1 | 0 | 3 |
| After second search (24 rejected proposals/repeat) | 1 | 0 | 3 |

The first search selects the first chamfer of segment
`d90d6c34-6e49-4507-a99e-bcd4d92a25b7`, removing U2.15's thermal error.
The validated intermediate board becomes the second stage's source. The
remaining error is the known U1.7 two-track cause. Every second-stage proposal
is rejected. Per repeat, 15 proposals retain the same thermal error and nine introduce
additional native errors (clearance or solder-mask bridges). All 24 preserve
saved-design identity, but none passes the error-subset gate.
The exact intermediate bytes are preserved on all three failed searches.

This is a negative generalization test of an **offline diagnostic**, not a
production fix or scored router run. Partial improvement is not a clean route.
The historical full suite remains 39/78 passing runs, 13/26 valid cases,
120 opens and 27 new thermal errors; it was not rerun. The selector still needs
multi-track geometry search and production integration with safe native recovery.
No engine, adapter, frozen input, checker or routing policy changed.

`verify.py` reconstructs every proposal and bounded ranking, checks the full
attempt schedule on exhaustion, replays acceptance/rejection, validates source
hashes and stage handoff, and compares native reports, saved design signatures,
rule sidecars and exact terminal partitions. All original design nodes survive
both stages (numeric formatting and derived fill excluded by the existing
signature). Replay verifies archived evidence, not independent native execution.

Reproduce from the repository root, using fresh output directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/multicause-search
tar -xzf "$R/c172-multicause-search/native.tar.gz" -C /tmp/multicause-search
/usr/bin/python3 -B "$R/c172-multicause-search/verify.py" --results /tmp/multicause-search
/usr/bin/python3 -B - <<'PY'
import json
from pathlib import Path
s=Path('/tmp/multicause-search')
for stage,role in [('native','original-segment'),('stage2','stage2-source')]:
    z=json.loads((s/stage/'summary.json').read_text())
    for marker in (role,'original-input'):
        d=s/marker;d.mkdir(exist_ok=True)
        for name,digest in z['source_sha256'].items():
            if marker in name:
                (d/('board'+Path(name).suffix)).write_bytes((s/stage/'sources'/digest).read_bytes())
PY
for pair in 'original-segment fresh-first' 'stage2-source fresh-second'; do
  set -- $pair
  taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/c171-marker-search/search.py" \
    --source "/tmp/multicause-search/$1/board.kicad_pcb" \
    --input /tmp/multicause-search/original-input/board.kicad_pcb \
    --out "/tmp/multicause-search/$2"
done
/usr/bin/python3 -B "$R/c172-multicause-search/render.py" --results /tmp/multicause-search --out /tmp/multicause-search/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Required typecheck, layer checks and all 859 engine tests pass (zero failures).
Both original and unpacked archive replays pass. 81 native checks are retained: six
first-stage checks and 75 second-stage checks.

![Two-stage native search](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c172-multicause-search/comparison.png?raw=true)
