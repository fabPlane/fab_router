This static native experiment varies only normal offset length for the two previously ranked R20 obstacle tracks. All 33 checks use the same full board, sidecars, host hyper-ms-lin, cores 20–25 and three repeats per candidate. Original track endpoints remain linked. The stored 0.508 mm zone gap supplies search scales; it is not an effective native rule resolver.

| Measurement (each of three repeats) | Original | Rank 1: 0.2032 mm | Rank 1: 0.3048 mm |
| --- | ---: | ---: | ---: |
| R20 target thermal errors | 1 | 1 | 0 |
| Total native errors | 6 | 6 | 5 |
| Native opens | 15 | 15 | 15 |
| Pad terminals / connected groups | 234 / 74 | 234 / 74 | 234 / 74 |

The 0.1016 mm offset also retains the error; 0.4064 and 0.5080 mm remove it. The second ranked track retains the target at every tested scale. All three repeats select `near-1-normal-0.6`, moving track `ba81d7fd-c368-4776-b597-cea64fcdd37f` by (+0.169073, −0.253609) mm. All original connected terminal pairs survive, the terminal inventory is exact, and no new error records appear. This brackets the first successful **tested** offset between 0.2032 and 0.3048 mm; it does not find a minimum or establish monotonicity. Holding direction constant demonstrates a scale effect on this fixture. Direction's contribution relative to prior pad-axis searches remains unresolved.

The diagnostic now accepts explicit finite, nonzero, unique normal scales, preserving its previous default candidate set. Four invalid scale lists are rejected before file I/O. The independent verifier validates candidate enumeration and fractional scales, rebuilds every native terminal partition, compares complete error records and target findings, and checks geometric deltas, selection and artifact hashes. It also re-verifies all 27 prior R20 outputs with the unchanged default scales. Native boards are losslessly gzip-compressed; hashes bind decompressed bytes.

Required checks PASS: typecheck, layer checks 65/0, 859 tests / 0 failures / 398454 assertions (230.29 s). Complete logs are retained here.

No production engine or adapter fix, routing benchmark, full-suite improvement, or pin bump. The full frozen reference remains 39/78 passing runs, 13/26 valid cases, 120 opens and 27 thermal errors. No history.csv row is added because no router run completed. Prior C1 candidates remain unresolved. This is evidence toward a repair, not a general repair or a production safety guarantee.

Reproduce from the repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
source=$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 "$asset/topology-doglegs.py" --source "$source" --pad d145de36-3889-4a3d-8c61-71242d4e107c --normal-scales 0.2 0.4 0.6 0.8 1 --out /tmp/r20-normal-scales
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 240 /usr/bin/python3 "$asset/verify-topology.py" "$asset/normal-scale-results"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 240 /usr/bin/python3 "$asset/verify-topology.py" "$asset/topology-results/r20"
python3 "$asset/scale-chart.py" "$asset/normal-scale-results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native errors versus normal offset scale](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/normal-scale-results/comparison.png?raw=true)
