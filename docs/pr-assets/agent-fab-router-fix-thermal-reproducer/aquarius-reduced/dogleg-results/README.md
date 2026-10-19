# Full-board endpoint-preserving doglegs

This static experiment modifies the completed Aquarius baseline output, with all
79 footprints, 130 vias, two zones and original routing terminals present. It
translates one of the reduced fixture's tracks by 100 µm in its measured local
outward direction and adds two short segments joining the translated endpoints
to their exact original positions. The original track width, layer and net are
preserved, as are all other board objects and both project/rule sidecars.

Same full board, host, native version 10.0.6 and cores 20–25; three fresh checks
per variant:

| Native finding, each repeat | Unchanged | Track 2, local +x | Track 3, local +y |
| --- | ---: | ---: | ---: |
| Target thermal error | 1 | 0 | 1 |
| Total errors | 6 | 5 | 6 |
| Opens | 15 | 15 | 15 |
| Segments | 336 | 338 | 338 |

The track-2 result removes precisely the target error; all remaining error
records match baseline exactly. Track 3 matches all baseline errors. Repeats
match exactly within each variant. The native open count remains 15; exact
endpoint preservation and equal open counts do not prove every connectivity
partition is identical. The board is still incomplete and has five other thermal
errors. This is neither automatic routing nor a production safety gate. The
full frozen suite has not been rerun and its 27 thermal errors remain unfixed
in the engine. No pin bump is justified.

This closes a specific gap in the reduced fixture experiment: one successful
translation remains effective when its original endpoints and all surrounding
board copper are retained. The track-3 translation's failure also shows why
results from the terminal-free reduction cannot establish full-board safety.

From the repository root, with a fresh output directory:

```bash
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
source_run="$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 "$asset/doglegs.py" --source "$source_run" --out /tmp/aquarius-doglegs
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

`summary.json` binds original inputs, script and all output files by SHA-256.
Each subdirectory retains the refilled board, native report, sidecars and log.
The script asserts repeated findings, byte-identical retained object trees
before native serialization, unchanged metadata, exact original link endpoints,
and removal of only the target error. A separate fresh rerun checks the final
script and reproduces all findings. Native CLI loading emits property-enum
assertion diagnostics but all nine DRC subprocesses complete successfully;
no diagnostic output is suppressed. The source board license is retained in
the parent directory. `comparison.png` charts measured results.
