R20's native thermal failure now has a smaller static repair witness: four footprints containing six positive-net pads, one track, one via and one zone. Translating that track by (+0.169073, −0.253609) mm and linking both original endpoints restores a thermal spoke. The retained pad, track, via and zone geometry comes from the completed reference output; project and rule sidecars remain exact. This adds diagnostics and regression controls, not an engine or adapter fix.

A 2 mm bounding-box crop starts with eight tracks, two vias and two zones. Greedy single-object deletion retains the failure and the successful repair while requiring the exact cropped terminal partition at every accepted step. Nine objects are removed. The last deletion pass cannot remove the remaining via or zone while preserving the failure. The moved track and all footprints/pads are protected: this is **not** a global minimum or an assertion that every retained pad is necessary.

All measurements use native version 10.0.6 on host hyper-ms-lin, cores 20–25. Each final board is checked three times with identical outcomes. These are static native checks, not router benchmark runs.

| Reduced witness, each of 3 repeats | Before | After endpoint-linked shift |
| --- | ---: | ---: |
| Target thermal errors / all errors | 1 / 1 | 0 / 0 |
| Native opens | 1 | 1 |
| Positive-net pad terminals / groups | 6 / 4 | 6 / 4 |
| Tracks / vias / zones | 1 / 1 / 1 | 3 / 1 / 1 |
| Lost connected terminal pairs | — | 0 |

For context, the prior **full-board** static witness retained all 234 terminals / 74 groups, reduced errors 6→5, and kept 15 opens (three repeats). Cropping intentionally removes other terminals; preservation here refers only to the six cropped terminals. The unchanged full frozen routing reference is 39/78 passing runs, 13/26 valid cases, 120 opens and 27 thermal errors. No new full routing run, improvement claim, pin bump, or history.csv row.

The independent verifier checks all 34 native reports, hashes (including decompressed boards), terminal groups, final geometry, endpoint links and repeat outcomes. Three native rewiring controls detect lost pairs despite unchanged component count. Forged summary controls: unchanged accepted 3/3; altered terminal inventory, error list or deletion acceptance rejected 9/9. Raw reports, boards, sidecars, native logs, summary and validation logs are retained. `minimal.kicad_pcb` plus matching sidecars is the portable pre-repair witness. `minimal.dsn` is its native export for further engine investigation; it does not carry the native thermal semantics. `portable-sha256.json` binds these files.

Required checks PASS: typecheck, layer checks 65/0, 859 tests / 0 failures / 398454 assertions (229.08 s).

Reproduce from the repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
source=$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 "$asset/reduce-repair.py" --source "$source" --out /tmp/r20-repair-reduction
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 240 /usr/bin/python3 "$asset/verify-repair-reduction.py" "$asset/repair-reduction-results"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 240 /usr/bin/python3 "$asset/repair-reduction-controls.py" "$asset/repair-reduction-results" --out /tmp/r20-repair-controls
python3 "$asset/render-repair.py" "$asset/repair-reduction-results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native copper before and after the endpoint-linked shift](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/repair-reduction-results/comparison.png?raw=true)
