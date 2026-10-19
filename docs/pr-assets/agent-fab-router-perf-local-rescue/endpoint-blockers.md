# Original endpoint geometry, cycle 21

Production routing code is unchanged. This offline audit uses the three seed-1
trial traces from cycle 20, their exact original DSN hashes, original endpoint
coordinates, and the existing convex-distance implementation. It does not route,
recheck native DRC, or establish that an alternative complete path exists.

The selected example is Paperino J4, connection `4:10:62`, trial 3, sheet 1.
Both rejected shaping variants end at original pad 62. Their recorded blockers
are immutable original pads on part A1, so their geometry survives trial rollback.

* Variant 0: pads 27 and 28 have core distance 12000 LU. Pad radius 9500 LU
  plus track half-width 1250 LU leaves 1250 LU = 125 µm copper clearance.
  Required spacing is 2000 LU = 200 µm. The clearance deficit is 75 µm;
  there is no extra safety margin in this exact rejection to remove.
* Variant 1: the segment overlaps pads 34 and 35 even at zero spacing.
  Pads 36 and 37 also fail the real spacing rule. Lowering an internal margin
  cannot legalise the overlapping copper.

A different approach path is required for these specific rejected segments.
A 75 µm displacement would only address the first pair in isolation; it is
not a legal repair proposal, nor evidence that a finer grid closes this net.
The graph path, endpoint attachment and shaping interaction remains to be
minimized into a genuine full-pipeline regression fixture before implementation.

Across the existing nine residual traces there are 1751 original-pad blocker
observations on original-endpoint segments: all 1751 fail the represented
spacing rule and 1219 overlap or touch pad copper. These are repeated trial
observations, not independent routes. Another 899 blocker observations are not
original pads and are deliberately excluded: their live trial geometry cannot
be reconstructed from the input alone. This is not a census of every segment
or every blocker, and cannot attribute the whole stall to this example.

No benchmark was run in cycle 21. The latest scored comparison remains the
26 cases × 3 repeats on the same host/cores from cycles 18 and 20:

| Metric | Prior diagnostic control | Current diagnostic control |
| --- | ---: | ---: |
| Passed | 39/78 | 39/78 |
| Opens | 120 | 120 |
| Existing new native errors | 27 | 27 |
| Attempt median seconds | 1.264383 | 1.229615 |
| Attempt p95 seconds | 18.213576 | 16.771766 |

All paired sessions, vias and lengths match. Historical shared-host timings
are descriptive only; this is not a speed improvement or a DRC-clean baseline.
See `trial-native.json` for the complete per-case median/p95/copper results.
There is no adopted recovery setting, no completion gain and no pin update.

Reproduce from the repository root, with the preserved native run directory:

```bash
assets=docs/pr-assets/agent-fab-router-perf-local-rescue
native=$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle20/native-complete
out=$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle21/reproduced.json
taskset -c 12-19 nice -n 10 timeout 120 bun "$assets/inspect-endpoint-blockers.ts" "$native" "$assets/trial-results.json" "$assets/trial-endpoints.json" "$out"
cmp "$out" "$assets/endpoint-blockers.json"
$HOME/bench/agents/codex-fabpcb-perf/scratch/plot-venv/bin/python "$assets/plot-endpoint-blockers.py" "$out" /tmp/cycle21-endpoint-blockers.png
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

The helper refuses existing outputs and mismatching DSN hashes before writing.
Strict standalone TypeScript checking, partition checks against the full scratch
report, deterministic regeneration and both negative guards were checked.
