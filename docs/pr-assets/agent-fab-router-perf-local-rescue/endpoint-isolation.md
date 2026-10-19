# Full-pipeline endpoint context reduction, cycle 22

The selected real residual connection `4:10:62` now has a ten-pad full-pipeline
regression fixture. No production routing, spacing, width, via or search setting
was changed. There is no recovery implementation or measured completion gain.

Twelve engine routes use the same original input, settings and seed 1 on
`hyper-ms-lin`, cores 12–19, three repeats per intervention. Each intervention
has byte-identical sessions across repeats. The three full controls also match
the previously native-scored session exactly. The table measures changes of
context, **not before/after routing improvements**.

| Context | Pads | Target residuals before → after (every repeat) | Target completed | Added engine violations | Median / p95 seconds |
| --- | ---: | --- | ---: | ---: | ---: |
| Full board, normal scheduling | 60 | 2 → 1 | 0/3 | 0 | 15.263 / 18.470 |
| Only target net scheduled, original obstacles | 60 | 2 → 1 | 0/3 | 0 | 4.142 / 4.473 |
| Only target net scheduled, final session applied, other copper locked | 60 | 1 → 1 | 0/3 | 0 | 3.126 / 3.246 |
| Two endpoints and six previously recorded pad blockers | 8 | 1 → 0 | 3/3 | 0 | 0.090 / 0.091 |

Here p95 is the maximum of three observations. Times describe this diagnostic
workload on a shared host; the contexts have different work and are not timing
controls. Engine exact DRC is zero before and after in all twelve routes. No
new native DRC check was run: the native baseline still has 27 thermal errors.

Other nets are ignored by duplicating their original net groups with new IDs
and names, preserving their category kinds, track widths, via rules and other
physical properties. Their pads and copper remain obstacles. The original
net groups stay attached to the target. All non-target copper/pads/pours are
checked byte-for-byte after isolated routes. The six-blocker intervention also
removes the third target pad and other copper; it does not show that six pads
are the sole cause of the original stall. It shows that these six blockers
alone do not reproduce it.

A deterministic deletion reduction starts with the original context and keeps
all three target pads. Chunk sizes 16, 8, 4, 2, 1 yield a ten-pad context:
`9, 10, 27, 29, 31, 33, 35, 37, 39, 62`. All 38 trials are retained in
`endpoint-reduction.json`; this includes the initial context and three final
repeats. Failed deletions are retained too. The final three repeats connect
9→10 with one track, leave 10→62 open, stop by stagnation, and have zero exact
violations and identical sessions. This is a deletion reduction, not a proof
of a globally minimum fixture or physical feasibility. It leaves original
rim/fences/rules intact and filters net pad references consistently.

The active regression reads the original 11 KB input plus the retained-ID
manifest under `test/data/near-complete-endpoint.*`, constructs that context,
and calls the public full pipeline twice. It guards deterministic output,
zero exact violations, unchanged retained geometry and preservation of the
completed short branch. A future legal closure is allowed; the test does not
require preserving the stall. The fixture now provides a concrete target for
the opt-in local attachment/finer-search experiment. It does not establish
that more passes, smaller margins, or finer grids will close the long branch.

Reproduce the fixture from this checkout without the native result archive:

```sh
taskset -c 12-19 nice -n 10 timeout 120 bun test test/near-complete-endpoint.test.ts
```

Reproduce context isolation and reduction after the existing full-native
reproduction command in `reproduce-trial-native.sh` has produced `NATIVE_ROOT`:

```sh
assets=docs/pr-assets/agent-fab-router-perf-local-rescue
work=$(python3 - "$NATIVE_ROOT" <<'PY'
import json, sys
from pathlib import Path
root=Path(sys.argv[1])
r=next(r for r in json.loads((root/'results.json').read_text()) if r['case']=='paperino-hw-paperino-shield-j4' and r['seed']==1)
print(root/r['evidence']/'work')
PY
)
taskset -c 12-19 nice -n 10 timeout 600 bun "$assets/isolate-endpoint.ts" "$work" /tmp/endpoint-isolation-new.json
taskset -c 12-19 nice -n 10 timeout 900 bun "$assets/reduce-endpoint.ts" "$work" /tmp/endpoint-reduction-new.json
python3 "$assets/plot-isolation.py" /tmp/endpoint-isolation-new.json /tmp/endpoint-isolation-new.png
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Outputs must not exist. Helpers verify the input hash before routing and reject
existing outputs; negative guards are retained. Timings vary on reproduction.
No frozen cases, checker, scoring, other worktrees or runtime files were edited.
The full 26×3 native suite, dense board, ladder and slow tier remain mandatory
before adopting a recovery change. They were not repeated for this fixture-only
change. Latest scored native results remain 39/78 passed, 120 opens and 27
existing new errors; no speedup, native safety improvement or pin bump is claimed.

Required checks passed: typecheck; 65 layer-checked files / zero violations;
860 tests / zero failures / 398,474 assertions (215.50 seconds). Standalone
strict TypeScript helper checks, Python AST, whitespace, provenance/measurement
checks, and both helpers’ input-hash/overwrite negative guards passed.
