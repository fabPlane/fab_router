# Pour vertex outside the board blocks an otherwise clear connection

This 1,541-byte DSN reduces the remaining GNDA open on rufs-smart-psu-j4 to
one rectangular surface pad above its own opposite-layer pour. There are no
tracks, vias, foreign pads, foreign pours, or keepouts. Both sheets are signal
sheets, as in the exported native board. Width is 200 um, spacing 200 um,
board clearance 500 um, and hole clearance 250 um. No rules are relaxed.

`resolveEndpoints` in `src/route/passes.ts` selects the nearest pour vertex:
(59.996, -89.090) mm for the pad at (65.108, -87.312) mm. The board starts at
x=60.000 mm and y=-89.000 mm. Thus this target is outside the board even before
clearance. The dedicated plane-via path is bypassed because the sheets have
signal roles. The generic multilayer route retains that unreachable endpoint
and stops stagnant. This is target selection, with neither a search timeout
nor obstacles boxing in the pad.

The controls isolate the mechanism. One ordinary 0.600/0.300 mm via beneath the
pad connects the original pour with zero engine violations. Moving only the
selected polygon vertex to (61.000, -88.000) mm lets the router complete with
two tracks and one via. That input change is a diagnostic, not a proposed repair.
The via is also a manually supplied geometric witness, not router output.

| Same host, cores 20–25; three repeats each | Original | Via witness | Inset-vertex control |
| --- | ---: | ---: | ---: |
| Reduced DSN final engine opens, each | 1 | 0 | 0 |
| Reduced DSN engine violations, each | 0 | 0 | 0 |
| Full native board final opens, each | 1 | 0 | Not measured |
| Full native board errors, each | 0 | 0 | Not measured |

The full native witness starts from the exact completed baseline output,
adds only that via, copies the same project/rules, then performs a fresh
native 10.0.6 refill/check in three independent directories. All six raw
reports are retained, including warnings. The portable script verifies the
starting board hash. It does not assert full design-node fidelity or provide
a live editor transaction, general thermal safety, or a production strategy.
No frozen board/checker is modified, and hand-edited diagnostic boards are
excluded from benchmark results. The existing full router result remains
39/78 runs passing, 13/26 cases valid 3/3, 120 opens, and 27 new thermal errors.
There is no production fix or gain claim in this PR. The active performance
work owns recovery through connected copper; these witnesses identify a
separate endpoint target and need no width/clearance relaxation.

From the repository root:

```bash
taskset -c 20-25 nice -n 10 timeout 120 bun docs/pr-assets/agent-fab-router-triage-pour-rim/controls.ts > /tmp/pour-engine-results.json
taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 -B docs/pr-assets/agent-fab-router-triage-pour-rim/native-witness.py --source /home/hyper/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-122/fab-router/final.kicad_pcb --out /tmp/pour-native-witness-new
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Use an unused native output directory. `engine-results.json` records all nine
engine controls; `native-summary.json` records the six full native checks.
`provenance.json` identifies source hashes and the original Apache-2.0 licensed
board (license retained alongside this derived fixture). The reduction removed
all foreign routing work, all other parts/pins, and unused definitions while
preserving the failing connection. Intermediate reducers and full staged
boards remain in the agent's c142 scratch directory; the committed small DSN
reproduces independently of those files.

![Measured open counts](https://github.com/fabPlane/fab_router/blob/agent/fab-router-triage-pour-rim/docs/pr-assets/agent-fab-router-triage-pour-rim/comparison.png?raw=true)
