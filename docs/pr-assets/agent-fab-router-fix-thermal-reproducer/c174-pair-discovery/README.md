# Marker-guided connected pair discovery

The offline corner selector now discovers compatible connected generated track
pairs without supplied causal UUIDs. It ranks eight generated tracks near actual
native thermal pad markers, excludes original copper, requires equal net, width
and layer and exactly one shared endpoint, and tests at most sixteen pairs with
sixteen corner proposals each. Ranking and UUID ties are deterministic.

Same J2-small complete intermediate board, rules, machine `hyper-ms-lin`,
cores 20–25, native 10.0.6; three independent repeats:

| Variant | Native errors/run | Opens/run | Repeats |
| --- | ---: | ---: | ---: |
| Before discovered-pair search | 1 thermal | 0 | 3 |
| After discovered-pair search | 0 | 0 | 3 |

All repeats select the thirteenth proposal of the first ranked pair. Native
validation requires a strict error-subset, preserved design data and terminal
connectivity. Rejected proposals return exact source bytes. Two new-tool tests
failed first for missing discovery, then pass; these are not engine regressions.
The replay verifier reconstructs discovery/proposals and checks saved native
reports, terminal partitions, original nodes, sidecars and source hashes.

This remains an offline diagnostic. Production integration, safe editor recovery
and general thermal repair are unresolved. The historical scored suite remains
39/78 passing runs, 13/26 valid cases, 120 opens, 27 new thermal errors; it was not
rerun. Engine, adapter, frozen inputs, checker and performance functions are unchanged.
Inputs and license derive from the adjacent c165 evidence. Native warnings are retained.

Reproduce from the repository root with fresh output directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/pair-discovery
tar -xzf "$R/c174-pair-discovery/native.tar.gz" -C /tmp/pair-discovery
/usr/bin/python3 -B "$R/c174-pair-discovery/verify.py" --results /tmp/pair-discovery
/usr/bin/python3 -B - <<'PY'
import json
from pathlib import Path
s=Path('/tmp/pair-discovery')
z=json.loads((s/'native/summary.json').read_text())
for role in ('stage2-source','original-input'):
    d=s/role;d.mkdir(exist_ok=True)
    for name,digest in z['source_sha256'].items():
        if role in name:
            (d/('board'+Path(name).suffix)).write_bytes((s/'native/sources'/digest).read_bytes())
PY
/usr/bin/python3 -B "$R/c174-pair-discovery/test_discover.py"
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/c174-pair-discovery/discover.py" \
  --source /tmp/pair-discovery/stage2-source/board.kicad_pcb \
  --input /tmp/pair-discovery/original-input/board.kicad_pcb \
  --out /tmp/pair-discovery/fresh
/usr/bin/python3 -B "$R/c174-pair-discovery/render.py" --results /tmp/pair-discovery --out /tmp/pair-discovery/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Pair discovery](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c174-pair-discovery/comparison.png?raw=true)
