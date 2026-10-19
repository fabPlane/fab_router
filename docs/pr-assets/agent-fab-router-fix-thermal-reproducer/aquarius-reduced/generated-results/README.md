Geometry-derived proposals now exercise the compact native thermal transaction without a fixed pad UUID, track UUID, or displacement. The diagnostic discovers the failing pad from the native report, ranks foreign-net tracks by centre-to-segment distance, and tries signed normal shifts at 0.2, 0.4, 0.6, 0.8 and 1.0 times the stored zone gap, retaining endpoint links. It stops at the first native-validated improvement. The stored gap supplies only a search scale; it is not an effective custom-rule resolver. Only the nearest track and one failing pad are supported here.

Host hyper-ms-lin, cores 20–25, identical compact board and sidecars, three repeats:

| Static native measurement | Before | Selected generated candidate |
| --- | ---: | ---: |
| Errors per repeat | 1 | 0 |
| Opens per repeat | 1 | 1 |
| Positive-net terminals / groups | 6 / 4 | 6 / 4 |
| Lost terminal pairs | — | 0 |
| Accepted repeats | — | 3/3 |

In every repeat, five proposals are rejected before the sixth (+0.6 gap) succeeds. Their error counts are 2, 1, 3, 1, 3, then 0. Every rejection returns exact original bytes. The candidate set and search schedule remain an experimental heuristic, with no general coverage claim. Twenty-one fresh native checks and the replay verifier validate the generated geometry, all reports/partitions, hashes and three selected boards. Input/sidecar hashes remain unchanged. The initial scratch run produced the same outcomes; the final retained run adds an artifact hash manifest.

This is a static diagnostic, not an engine or adapter fix. No routing benchmark was run, so there is no new routing history row or pin bump. The historical full routing reference remains 39/78 passing runs, 13/26 valid cases, 120 opens, 27 thermal errors. No frozen input, scoring, rule, checker, engine source or shared runtime changed.

Reproduce from repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/generated-transaction.py" --source "$asset/repair-reduction-results/minimal.kicad_pcb" --out /tmp/generated-transaction
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 "$asset/verify-generated-transaction.py" /tmp/generated-transaction --source "$asset/repair-reduction-results/minimal.kicad_pcb"
python3 "$asset/render-generated.py" /tmp/generated-transaction
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Generated native transaction attempts](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/generated-results/generated.png?raw=true)

Required checks PASS: typecheck; layer checks 65 files / 0 violations; 859 tests / 0 failures / 398454 assertions (225.48 s). Complete log retained in checks.log.
