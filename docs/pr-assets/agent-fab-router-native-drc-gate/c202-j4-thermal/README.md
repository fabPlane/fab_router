# Complete-board J4 thermal repair regression

This cycle adds a native complete-board regression for the remaining zero-open J4
thermal failure. Production search and routing code are unchanged from 88a89a42.
The source/routed snapshot is seed 1 of cycle201's complete 26-case, three-seed run.
The two additional searches repeat that exact snapshot; they are not different seeds.
The copied regression fixture includes upstream license, project/custom rules and
uncompressed hashes. Frozen benchmark inputs and scoring are unchanged.

Native version 10.0.6 reports one introduced front-copper starved thermal at U2.15:
required minimum two spokes, actual one. Generated signal segment
`e41eeb66-686e-4759-8f40-22af4d4cc6e4` passes diagonally beside the pad.
The first single-segment proposal replaces it with three connected segments at the
same endpoints and restores the second ground spoke. This is a complete-board
reproducer and repair witness, not a globally minimized board or an engine fix.
The independent verifier checks source/current connected-terminal partitions,
source snapshot fidelity, proposal manifests and exact published bundle hashes.
All generated proposals, including untested proposals after the first accepted one,
are retained in the archive. No native attempt was stopped or omitted.

| Same-machine measurement | Before | After | Repeats |
|---|---:|---:|---:|
| J4 introduced native thermal errors, summed | 3 | 0 | Same complete seed1 snapshot ×3 |
| J4 opens / lost source pairs / lost routed pairs | 0 / 0 / 0 | 0 / 0 / 0 | ×3 |
| Accepted complete offline bundles | 0/3 | 3/3 | ×3 |
| Checked proposals / native DRC checks | — | 3 / 36 | Three searches total |

All repaired board hashes match
`ff59af75bcb93109ef803f83efcb219e56c1c8f8d61031af1267afeae38268cf`.
An additional extracted-bundle recheck runs three fresh native checks and confirms
zero errors, zero opens and zero lost terminal pairs. Initial replay was invoked
before repeat 2 finished, so result.json was absent; it was rerun successfully after
all searches completed. No routing or speed improvement is claimed.

The production benchmark does not invoke offline search. Its last complete scored
run remains cycle201: 39/78 passed, 13/26 cases passing 3/3, 120 opens and 27
introduced native thermal errors. It was not rerun this cycle because no production
routing code changed. J2-small and J4 now have repeated connection-preserving offline
repair results; Aquarius remains unresolved, with six thermals and 348 lost source
terminal pairs per seed. Application/adapter integration is still required.

Reproduce the three searches and independent replay from the repository root:

```bash
mkdir /tmp/c202-saved
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c202-j4-thermal/native-search.tar.xz -C /tmp/c202-saved
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c202-j4-thermal/verify.py /tmp/c202-saved/native
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c202-j4-thermal/reproduce.py --repo "$PWD" --fixtures /tmp/c202-saved/native/fixtures --out /tmp/c202-search-repeats
cp -r /tmp/c202-saved/native/fixtures /tmp/c202-search-repeats/fixtures
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c202-j4-thermal/verify.py /tmp/c202-search-repeats
taskset -c 20-25 nice -n 10 bun run typecheck
taskset -c 20-25 nice -n 10 bun run check:layers
taskset -c 20-25 nice -n 10 bun run test
```

The named regression is `bounded native search restores the J4 ground-pad thermal
without opening routed nets` in test/native-thermal-search.test.ts. Its baseline
assertion proves the fixture has the reported native error before search; it is new
coverage for existing search functionality, not a fail-first claim for a new fix.
The fixture/test was added before that test file loaded in the running full suite;
final static checks were rerun after the addition. Required checks exited zero:
typecheck, 65 layer-checked files with zero violations, 910 tests, zero failures,
398,704 assertions in 611.65 seconds. The new J4 test passed with 11 assertions.
Final required test status is
recorded in checks.log.gz and process-status.json. Source-hashes.json protects all
measured production/native-search files. Offline publication does not implement
editor application/undo or guarantee complete metadata fidelity.

comparison.png shows actual refilled front-copper SVG exports around U2.15.
To regenerate it, decompress before.svg.gz and after.svg.gz beside render.py and run
`python3 render.py` with rsvg-convert installed.

The custom-rule snapshot retains its original final blank line; staged diff-check
reports that whitespace warning. Rule bytes are deliberately preserved exactly.
