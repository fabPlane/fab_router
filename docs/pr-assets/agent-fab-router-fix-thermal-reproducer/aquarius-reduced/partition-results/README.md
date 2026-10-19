# Terminal groups after static doglegs

The previous full-board dogleg experiment preserved segment endpoints and the
native open count. Those checks alone cannot establish that existing terminal
connections survive. This audit rebuilds native connectivity on each of the
nine already-refilled boards and records, for every positive-net pad UUID, all
pad UUIDs returned by the native connected-item query, including the pad itself.
The query results must form an equivalence relation and contain only one net.
All prior board, report and sidecar hashes are verified before loading; board
bytes are verified unchanged afterwards.

Same retained full board, host, native version 10.0.6 and cores 20–25; three
previous native DRC repeats per variant, each audited here:

| Finding, each repeat | Baseline | Track 2 dogleg | Track 3 dogleg |
| --- | ---: | ---: | ---: |
| Positive-net pad terminals | 234 | 234 | 234 |
| Terminal groups | 74 | 74 | 74 |
| Lost connected terminal pairs | 0 | 0 | 0 |
| Exact baseline terminal partition | yes | yes | yes |
| Previously measured native errors | 6 | 5 | 6 |
| Previously measured native opens | 15 | 15 | 15 |

The native connectivity partition is identical for every retained board. This
adds evidence for the track-2 dogleg without asserting an engine fix, automatic
routing, general native safety or success on the frozen suite. Five thermal
errors and 15 opens remain in that board. No new routing or DRC runs were
performed, so these measurements must not be logged again as benchmark runs.

A four-terminal native control starts with three connected pads and one isolated
pad. Moving one bridge isolates the first pad and connects the last pad instead.
The terminal group sizes remain `[1, 3, 3, 3]` and the component count stays two,
but two previously connected terminal pairs are lost. The audit rejects that
mutation and accepts unchanged geometry, three times. This demonstrates why a
count-only guard is insufficient. The control has no zones or vias and does not
establish coverage of every native topology or custom rule.

From the repository root, using a fresh output directory:

```bash
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 "$asset/terminal-partitions.py" --boards "$asset/dogleg-results" --out /tmp/aquarius-terminal-partitions
cmp /tmp/aquarius-terminal-partitions/summary.json "$asset/partition-results/summary.json"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Two independent audit executions produced byte-identical summaries. Full pad
membership is retained in `summary.json`; the native library's diagnostic
messages are retained in `native.log`. The report describes connectivity of
already-refilled saved files, not an atomic acceptance/publication operation.
