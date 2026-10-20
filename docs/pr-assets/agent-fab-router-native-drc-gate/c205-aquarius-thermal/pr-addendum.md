Cycle 205 adds a complete native regression for the remaining Aquarius failure and reduces one thermal error to a single horizontal B.Cu signal segment beside GNDD U1.39. Source geometry, project/custom rules and original zones remain unchanged. The segment comes from the placement-corrected seed-1 output; its pad thermal has one spoke where two are required. Removing the segment restores zero errors. The current single-track proposal family emits no paths for horizontal or vertical segments, giving a concrete next search gap. The full output also loses source connections; that separate blocker remains protected by the gate.

Fresh native 10.0.6 refills on the same machine/cores 20–25, three repeats of the same retained seed-1 board per witness:

| Witness | Added copper items | New thermal errors per repeat | Opens per repeat | Lost source pairs per repeat |
|---|---:|---:|---:|---:|
| Original source control | 0 | 0 | 110 | 0 |
| Complete generated output | 466 | 6 | 15 | 348 |
| Reduced diagnostic output | 1 segment | 1 | 111 | 0 |

Twenty deletion/native checks and nine repeat checks are archived, including every intermediate failure. The reduction minimizes added copper only; it does not minimize the complete source board. Deletion trials can add opens or unrelated violations and are never scored repairs. The regression covers the existing failure and strict rejection; no behavioral fail-first fix or new routing improvement is claimed.

Full-suite scores are retained rather than rerun for this fixture/test change: the optional pipeline remains 45/78 passes, 15/26 valid cases, 120 opens, 18 thermal errors from cycle 204; last default pipeline remains 39/78 passes, 13/26 valid cases, 120 opens, 27 thermal errors from cycle 203. Production routing/search implementations are unchanged this cycle.

Reproduce the new regression and required checks:

```sh
taskset -c 20-25 nice -n 10 bun test test/native-aquarius-thermal.test.ts --timeout 120000
taskset -c 20-25 nice -n 10 bun run typecheck
taskset -c 20-25 nice -n 10 bun run check:layers
taskset -c 20-25 nice -n 10 bun run test
```

![Single-segment thermal witness](https://github.com/fabPlane/fab_router/blob/agent/fab-router-native-drc-gate/docs/pr-assets/agent-fab-router-native-drc-gate/c205-aquarius-thermal/comparison.png?raw=true)

[Full trial archive, independent replay, exact native commands and limits](docs/pr-assets/agent-fab-router-native-drc-gate/c205-aquarius-thermal/README.md). Freshly extracted replay checks all 29 native reports, source copper inventory, sidecar bytes and terminal-pair counts. Replay uses retained native reports; it does not rerun native DRC.

Validation: final typecheck and layer checks pass; full suite 912 tests, zero failures, 398,736 assertions. The new native regression passes all 16 assertions both independently and in the complete suite. No executable routing or search implementation changed.
