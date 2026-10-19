# Complete multi-cause native search

The offline selector now composes marker-guided single-track and connected-pair
searches. After each accepted strict reduction of native errors, it reranks
candidates against the current board and remaining markers. At most eight stages,
each with eight tracks (six chamfers each) and sixteen pairs (sixteen corner
moves each), can run. Only a completely clean route is published. If search
exhausts its candidates or stage limit, the complete original source bytes are
returned, including when earlier stages made partial progress. Checker exceptions
reject the candidate through the existing validation gate.

Same complete J2-small route, rules, machine `hyper-ms-lin`, cores 20–25,
native 10.0.6, three independent repeats:

| Variant | Native errors/run | Opens/run | Repeats |
| --- | ---: | ---: | ---: |
| Before combined search | 2 thermal | 0 | 3 |
| After single-track stage | 1 thermal | 0 | 3 |
| After connected-pair stage / published output | 0 | 0 | 3 |

All three repeats use one single-track proposal followed by 37 second-stage
proposals (24 single-track, then 13 connected-pair). The archive contains 117
native checks, including rejected proposals, with zero aggregate opens. Required
typecheck, layer checks and all 859 engine tests pass; four tool tests pass.

Inputs preserve the original design and come from the adjacent c165/c172 evidence,
with its license. The selector receives no causal copper UUIDs. Rejected attempts
preserve the current stage bytes; failure of the full search restores its initial
bytes. Native validation checks design identity, rule sidecars, strict error
multiset reduction, terminal inventory, connected terminal pairs and opens.
The retained successful runs additionally preserve exact terminal partitions and
all original design nodes. Four new-tool tests cover refreshed discovery,
whole-search rollback after partial progress, stage exhaustion and checker failure;
they failed first for the missing module, then pass. They are not engine regressions.

This remains an offline diagnostic, not engine/editor integration, a general
thermal repair guarantee, or a scored router improvement. The historical full
suite remains 39/78 passing runs, 13/26 valid cases, 120 opens, 27 new thermal
errors; it was not rerun. No source, adapter, frozen input or checker changed.
Native report warnings remain in the archive. Production integration and safe
editor recovery remain unresolved.

Reproduce from the repository root with fresh output directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/complete-search
tar -xzf "$R/c175-complete-search/native.tar.gz" -C /tmp/complete-search
/usr/bin/python3 -B "$R/c175-complete-search/verify.py" --results /tmp/complete-search
/usr/bin/python3 -B - <<'PY'
import json
from pathlib import Path
s=Path('/tmp/complete-search')
z=json.loads((s/'native/summary.json').read_text())
for role in ('original-segment','original-input'):
    d=s/role;d.mkdir()
    for name,digest in z['source_sha256'].items():
        if role in name:
            (d/('board'+Path(name).suffix)).write_bytes((s/'native/sources'/digest).read_bytes())
PY
/usr/bin/python3 -B "$R/c175-complete-search/test_complete.py"
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/c175-complete-search/complete.py" \
  --source /tmp/complete-search/original-segment/board.kicad_pcb \
  --input /tmp/complete-search/original-input/board.kicad_pcb \
  --out /tmp/complete-search/fresh
/usr/bin/python3 -B "$R/c175-complete-search/render.py" --results /tmp/complete-search --out /tmp/complete-search/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Complete search](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c175-complete-search/comparison.png?raw=true)
