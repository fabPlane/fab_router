# Complete-board thermal cause census

Single-item ablations locate generated copper that contributes to **all six**
Aquarius J4 thermal failures on the complete baseline output. The five track
witnesses and one through-via witness each remove exactly the indicated thermal
error when deleted. These are separate deletions from the same complete source,
not a sequence or a repaired board. Nearby tracks are selected independently for
each marker (eight per marker, 41 unique tracks); the unresolved C1 marker then
receives eight nearest generated through-via controls.

Same complete board, rules, machine `hyper-ms-lin`, cores 20–25, native version
10.0.6, **three fresh refill/DRC repeats per configuration**. The baseline is
6 errors / 15 opens in each repeat. Each deletion changes only one generated
item; the original input copper is excluded. Every other source node and all
rule sidecars are retained and checked against the saved native design.

| Deleted generated item | Error removed | Errors before → after | Opens before → after | Lost terminal pairs |
| --- | --- | ---: | ---: | ---: |
| Via `d3812c01…` | C1.2 | 6 → 5 | 15 → 16 | 2 |
| Track `ba81d7fd…` | R20.1 | 6 → 5 | 15 → 16 | 2 |
| Track `21768f94…` | U1.39 | 6 → 5 | 15 → 14 | 0 |
| Track `bc6b0ccc…` | U1.46 | 6 → 5 | 15 → 15 | 1 |
| Track `2e47398b…` | U1.48 | 6 → 5 | 15 → 15 | 2 |
| Track `2e466795…` | U1.53 | 6 → 5 | 15 → 15 | 52 |

The previous global eight-track budget contains **none of the five causal track
witnesses**. Layer filtering alone therefore left all of these measured causes
outside the proposal pool. A per-marker budget exposes them; the via still
requires a separate item class. This explains a concrete limit of the earlier
negative search without claiming that a larger budget guarantees a repair.

U1.53 demonstrates why an unchanged open count cannot establish terminal
preservation: its deletion loses 52 connected terminal pairs. C1 demonstrates
why a segment-only cause search is incomplete: a through-via contributes to its
failure. Only the U1.39 deletion satisfies the existing offline acceptance
policy (strict native error reduction, no lost terminal pairs and no additional
opens). It still leaves five errors and fourteen opens. These ablations do not
establish unique causes, minimum repair sets, native spoke topology, or a
production repair policy. No deleted candidate is applied to an input file.

The unchanged production engine still has **39/78 passing runs, 13/26 valid
cases, 120 opens and 27 thermal errors** in the historical complete suite. That
suite was not rerun; no routing score or speed improvement is claimed. No engine,
adapter, frozen case, scoring, checker or shared runtime changes. Typecheck,
layer checks and all 859 engine tests pass. This cycle adds measured causal
fixtures and evidence checks, not a failing/passing engine regression or fix.

`native.tar.xz` retains all 153 native boards/reports (126 track checks and 27
via checks, including separate baselines), source snapshots, complete terminal
partitions and every deletion result. `findings.json` records full item UUIDs,
geometry, marker rank, membership in the old global eight-track budget and
native policy outcomes. The verifier regenerates each deletion, checks every
other source node, native saved-design identity, rules, reports, terminal groups
and exact repeated findings. Original source licensing/provenance is retained
in adjacent `aquarius-reduced/LICENSE` and `c176-aquarius-search/`.

Reproduce from the repository root with native version 10.0.6 and fresh paths:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c178-causal-tracks
mkdir -p /tmp/thermal-causal
tar -xJf "$R/native.tar.xz" -C /tmp/thermal-causal
/usr/bin/python3 -B "$R/restore.py" --results /tmp/thermal-causal
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/verify.py" --results /tmp/thermal-causal/native
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/verify.py" --results /tmp/thermal-causal/vias --vias
taskset -c 20-25 nice -n 10 timeout 3600 /usr/bin/python3 -B "$R/ablate.py" --source /tmp/thermal-causal/source/board.kicad_pcb --input /tmp/thermal-causal/input/board.kicad_pcb --out /tmp/thermal-causal/fresh-tracks
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/vias.py" --source /tmp/thermal-causal/source/board.kicad_pcb --input /tmp/thermal-causal/input/board.kicad_pcb --out /tmp/thermal-causal/fresh-vias
/usr/bin/python3 -B "$R/report.py" --results /tmp/thermal-causal/native --vias /tmp/thermal-causal/vias --out /tmp/thermal-causal/findings.json
cmp "$R/findings.json" /tmp/thermal-causal/findings.json
/usr/bin/python3 -B "$R/render.py" --findings /tmp/thermal-causal/findings.json --out /tmp/thermal-causal/comparison.svg
rsvg-convert /tmp/thermal-causal/comparison.svg -o /tmp/thermal-causal/comparison.png
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Complete-board causal deletions and terminal losses](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c178-causal-tracks/comparison.png?raw=true)
