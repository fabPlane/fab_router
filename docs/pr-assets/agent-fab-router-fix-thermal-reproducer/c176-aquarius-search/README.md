# Complete Aquarius bounded-search generalization

This applies the unchanged c175 complete-search diagnostic to the complete
Aquarius J4 routed output from the completed shared baseline (seed 1). Each
repeat starts from the same original bytes; these are three native search
repeats, not three routing seeds. No engine or integration code changes.

Same complete board/rules/machine `hyper-ms-lin`, cores 20–25, native 10.0.6:

| Variant | Native errors/run | Opens/run | Repeats |
| --- | ---: | ---: | ---: |
| Before search | 6 thermal | 15 | 3 |
| After search / exact-byte rollback | 6 thermal | 15 | 3 |

Each repeat exhausts 36 single-track proposals and 32 connected-pair proposals,
with zero accepted intermediates. Of the 68 proposals, 19 retain six errors;
49 add errors (7–15 total). No checker exceptions or saved-design drift occur.
All 207 native checks are retained, totaling 1,917 errors and 3,105 opens across
baseline and rejected proposals. These aggregates are diagnostic accounting,
not suite scores. Required typecheck/layer checks and all 859 engine tests pass.
No production fix, scored gain, or pin bump is claimed.

The marker ranking ignores thermal layers: all six reported thermal failures
are on B.Cu, but the first four of eight ranked segments are on F.Cu. Both
connected pairs are retained too, including the front-layer pair. `ranking.py`
reconstructs this result using zone UUID/layer identity and actual pad markers,
without parsing the human-readable error description. This identifies wasted
search budget: 12 single-track and 16 pair proposals per repeat use F.Cu.
The remaining 40 B.Cu proposals also fail. Layer filtering alone has not been
tested and is not claimed to repair the board.

The bounded selector must reach zero native errors to publish. Strict partial
reductions are insufficient: whole-search failure restores the exact initial
source. Every attempted proposal, refilled board, native report and checker log
is retained, including candidates that add errors. `verify.py` reconstructs
all proposal bytes and decisions, checks native evidence/design identity, rules,
terminal partitions and protected original source nodes, and verifies rollback.
The original routed baseline has already-recorded tiny pad-position differences
from its input; this diagnostic preserves the routed source and does not claim
to correct those differences.

The source license is retained in the adjacent `aquarius-reduced/LICENSE`.
`baseline-record.json` identifies the original run; `baseline-snapshot.json`
records the full shared baseline, read-only: 39/78 passes, 13/26 valid cases,
120 opens, 27 new thermal errors. It is not a new full-suite run.

Reproduce from the engine repository root with native 10.0.6 and fresh directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/aquarius-search
tar -xJf "$R/c176-aquarius-search/native.tar.xz" -C /tmp/aquarius-search
/usr/bin/python3 -B "$R/c176-aquarius-search/verify.py" --results /tmp/aquarius-search
/usr/bin/python3 -B "$R/c176-aquarius-search/restore.py" --results /tmp/aquarius-search
taskset -c 20-25 nice -n 10 timeout 7200 /usr/bin/python3 -B "$R/c175-complete-search/complete.py" \
  --source /tmp/aquarius-search/source/board.kicad_pcb \
  --input /tmp/aquarius-search/input/board.kicad_pcb \
  --out /tmp/aquarius-search/fresh
/usr/bin/python3 -B "$R/c176-aquarius-search/ranking.py" --results /tmp/aquarius-search --out /tmp/aquarius-search/ranking.json
/usr/bin/python3 -B "$R/c176-aquarius-search/render.py" --results /tmp/aquarius-search --out /tmp/aquarius-search
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Aquarius complete-board search](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c176-aquarius-search/comparison.png?raw=true)
