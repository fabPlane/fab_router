# Rotated back-layer thermal failure reduced from the completed baseline

This static native reproducer preserves Aquarius U1.39 (315-degree rounded
rectangle, 75 micrometre corner radius) and its B.Cu zone. It has one pad,
three 0.2032 mm tracks, no vias, and one zone. Its sole native error is
`starved_thermal`: one spoke, minimum two. This is not a router fix or a new
routing benchmark. All 27 baseline thermal errors remain unresolved.

Fresh native refill plus DRC, same host and cores 20–25, three repeats per row:

| Fixture control | Before: all tracks | After: indicated deletion |
| --- | ---: | ---: |
| First track removed | 1 error, 0 opens each | 0 errors, 0 opens each |
| Second track removed | 1 error, 0 opens each | 0 errors, 0 opens each |
| Third track removed | 1 error, 0 opens each | 0 errors, 0 opens each |
| All tracks removed | 1 error, 0 opens each | 0 errors, 0 opens each |

The shared before column describes the same three runs, not twelve runs.
Fifteen native checks total. Deleting obstacles is a diagnostic control and
would discard intended routing; it is not an acceptable production remedy.
The three non-ground tracks have different nets. Their terminals have been
removed, so zero opens in this static fixture does not establish completion
of those nets. There is no routing attempt, engine regression, or native
transaction implementation here.

The reducer first retained objects whose native bounding boxes intersect a
2 mm square radius around the pad, then deleted pad/copper/zone UUID groups
while requiring the exact target and no other error. Single-object deletion
trials finish the search. This establishes irreducibility only among retained
candidate objects; the board outline, zone polygon, graphics and unused net
definitions have not been geometrically minimized. `reduction.json` retains
24 trials and their exact native findings.

`provenance.json` verifies that pad geometry, each retained track and the full
zone definition (excluding refill polygons) match the completed baseline
output. Both project and rule sidecars match the output and original input
byte-for-byte. The pad position is the baseline output position, with its
previously recorded +8/-46 nm displacement from the original input. That
small displacement is not attributed to the failure. `LICENSE` preserves
the source board license.

`board.dsn` is a native export for further engine diagnostics. It does not
encode native thermal metadata and is not claimed to reproduce native
starvation when routed independently. Keep the native board and sidecars.
`results/` retains all fifteen refilled boards, native JSON reports and hashes.
The comparison image uses actual B.Cu exports after refill.

From the engine repository root, using native version 10.0.6:

```bash
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify.py" --out /tmp/aquarius-native-controls
source_run="$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 "$asset/reduce.py" --source "$source_run" --out /tmp/aquarius-reduction
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 "$asset/provenance.py" --source "$source_run" --original "$HOME/bench/repos/fab_pcb/benchmarks/autorouter/cases/kitspace-aquarius-j4/board.kicad_pcb" --out /tmp/aquarius-provenance
kicad-cli pcb export svg --layers B.Cu --page-size-mode 2 --exclude-drawing-sheet --mode-single --output /tmp/aquarius-all.svg /tmp/aquarius-native-controls/all-1/board.kicad_pcb
kicad-cli pcb export svg --layers B.Cu --page-size-mode 2 --exclude-drawing-sheet --mode-single --output /tmp/aquarius-control.svg /tmp/aquarius-native-controls/without-track-1-1/board.kicad_pcb
python3 "$asset/render.py" /tmp/aquarius-all.svg /tmp/aquarius-control.svg /tmp/aquarius-comparison.svg
rsvg-convert /tmp/aquarius-comparison.svg -o /tmp/aquarius-comparison.png
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Production source and engine tests remain unchanged. No frozen cases, checker,
scoring or shared runtime were edited. No full sweep or history row is added
because these are static native checks without a router run.
