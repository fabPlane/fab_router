This diagnostic applies the previously measured fixed track displacement to the compact native thermal witness through an in-memory transaction. It accepts only a strict multiset subset of original native errors, identical positive-net pad inventory, no lost connected terminal pairs, and no increase in native opens. Rejection and checker exceptions return the exact original bytes. Exceptions are recorded as rejection reasons; they are not reported as successful checks.

This is not a production repair: the displacement and track identifier are witness-specific, there is no engine/adapter integration, and metadata-derived candidate generation remains open. No frozen board, checker, rule, engine source, or shared runtime changes.

Host hyper-ms-lin, cores 20–25, native version 10.0.6; same compact input, three repeats per candidate:

| Static transaction measurement | Before | After accepted repair |
| --- | ---: | ---: |
| Native thermal / all errors, each repeat | 1 / 1 | 0 / 0 |
| Native opens, each repeat | 1 | 1 |
| Positive-net terminals / groups | 6 / 4 | 6 / 4 |
| Lost connected terminal pairs | — | 0 |

Repair accepted 3/3. Unchanged, displaced connected pad, removed positive-net pad, injected timeout, and injected checker failure rejected 15/15 with exact byte rollback. The independent verifier rebuilds native partitions and reads all 13 native reports, checks 12 published board files and all 18 decisions. Timeout/failure controls exercise the transaction exception path, not a real native timeout. The initial proposed track-only disconnection controls did not lose terminal connectivity, and an initial removed-pad control selected a nonpositive-net pad; these invalid controls were replaced before the final run. Their failed runs remain in private scratch and are excluded from these results.

No routing benchmark was run; history.csv has no new routing row. The unchanged historical full-suite reference remains 39/78 passing, 13/26 valid cases, 120 opens, 27 thermal errors. No routing improvement or pin bump is claimed.

Reproduce from repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/transaction.py" --source "$asset/repair-reduction-results/minimal.kicad_pcb" --out /tmp/r20-transactions
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 "$asset/verify-transaction.py" /tmp/r20-transactions --source "$asset/repair-reduction-results/minimal.kicad_pcb"
python3 "$asset/render-transaction.py" /tmp/r20-transactions
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native transaction decisions](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/transaction-results/transactions.png?raw=true)

Required checks PASS: typecheck; layer checks 65 files / 0 violations; 859 tests / 0 failures / 398454 assertions (226.93 s). Native rule sidecar whitespace is retained byte-for-byte; diff whitespace warnings on those raw files are intentional.
