A static native experiment finds an R20 repair witness while C1 remains unresolved. Rank at most two foreign tracks by their stored-gap envelopes overlapping missing 0.100 mm-wide filled-copper corridors; test normal offsets ±gap and ±2gap, retaining original endpoints through links. The stored 0.508 mm zone gap is a search scale, not an effective-rule resolver. All 54 native checks use the same original full board and sidecars, host, cores 20–25 and three repeats per candidate.

| Target / measurement, each repeat | Original | Selected static candidate |
| --- | ---: | ---: |
| R20 native target thermal errors | 1 | 0 |
| R20 total native errors | 6 | 5 |
| R20 native opens | 15 | 15 |
| R20 pad terminals / connected groups | 234 / 74 | 234 / 74 |
| C1 native target thermal errors | 1 | 1 |
| C1 total native errors | 6 | 6 (original retained) |

R20 selects `near-1-normal-1` in all three repeats: track `ba81d7fd-c368-4776-b597-cea64fcdd37f`, translation (+0.281788, −0.422682) mm. No new error records or lost terminal pairs; the original terminal inventory is exact. The opposite direction removes R20's error but adds errors and is rejected. A larger positive offset also qualifies. The selected track is already nearest by centre distance: this does **not** demonstrate better ranking. Larger normal offsets differ from the previous 0.1016 mm pad-axis search, so cause attribution between direction and scale is unresolved. C1 candidates all retain the target error; some add errors or an open and are rejected.

Seven synthetic polygon controls pass three times, including holes, disjoint regions, symmetry and unchanged inputs. An independent verifier reconstructs every native terminal partition, complete report error multiset, target finding, geometric delta, eligibility/selection and topology ranking, validating artifact hashes for all 54 outputs. Board files are losslessly gzip-compressed; hashes bind decompressed native bytes.

Required validation: typecheck PASS, layer checks 65/0, 859 tests PASS / 0 failures / 398454 assertions (246.46 s). Full logs are retained here.

No production engine or adapter change, new routing benchmark, full-suite gain, or pin bump. The frozen routing reference remains 39/78 passes, 13/26 cases valid 3/3, 120 opens and 27 thermal errors. Static native postprocessing does not update that score. No history.csv row is added because no router run completed.

Reproduce from the repository root, with the native baseline source available:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
source=$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 /usr/bin/python3 "$asset/topology-doglegs.py" --source "$source" --pad d145de36-3889-4a3d-8c61-71242d4e107c --out /tmp/topology-r20
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 /usr/bin/python3 "$asset/topology-doglegs.py" --source "$source" --pad 0058b9c6-73af-4ba8-a061-fb00a457a84f --out /tmp/topology-c1
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/topology-controls.py" /tmp/topology-controls.json
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 /usr/bin/python3 "$asset/verify-topology.py" "$asset/topology-results/r20"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 /usr/bin/python3 "$asset/verify-topology.py" "$asset/topology-results/c1"
python3 "$asset/topology-chart.py" "$asset/topology-results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native target and total errors](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/topology-results/comparison.png?raw=true)
