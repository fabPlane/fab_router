# Preserve connected terminals through shove cascades

A fixed endpoint does not protect pads or held branches attached to a track's interior.
The two minimized fixtures start with A/B/C connected and D isolated. Before the fix,
shove returns true and detaches C: one open becomes two, with zero spacing violations.
After the fix, shove rejects this trial and restores the records, journal and live index.
The independent cascade regression protects a terminal on the second obstacle net.

`before.json` and `after.json` contain three repeats of each fixture, including actual
geometry. The PNG renders their first records; it is synthetic engine geometry, not a
native benchmark board. Existing successful channel and cascade tests remain controls.

The conservative fix snapshots all pad/non-prior-pour terminal groups before a shove,
then checks membership after the full cascade. Any split rewinds the whole trial. It
can reject a clearance-safe displacement rather than search for another terminal-safe
shape. Subsequent routing strategies remain available. Native thermal semantics are
not represented by these fixtures and are not fixed here.

Reproduce from the repository root:

```bash
bun test test/shove-terminals.test.ts test/shove.test.ts
bun run typecheck && bun run check:layers && bun run test
python3 docs/pr-assets/agent-fab-router-fix-shove-terminals/baseline-audit.py > /tmp/shove-before.json
bun docs/pr-assets/agent-fab-router-fix-shove-terminals/audit.ts > /tmp/shove-after.json
python3 docs/pr-assets/agent-fab-router-fix-shove-terminals/render.py
```

For a before audit, extract `src/route/shove.ts` from main `69cf598` into a scratch file,
resolve its relative imports against this repository's `src/route/`, and pass its absolute
path as the first argument to `audit.ts`. No frozen benchmark or runtime changes.

Native nonregression command (same host, cores, frozen cases/settings and three repeats):

```bash
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c24-after-full
```

Full native result: 39/78 passes, 13/26 cases valid 3/3, 120 opens, 27 new
thermal errors before and after. Every per-case/seed pass, opens, errors, vias and
length value is identical. Median route seconds 1.172079 → 1.103216 (-5.9%);
descriptive shared-host observation with tests partly overlapping, no speed claim.
All 74 source hashes match b23a9da; all eight comparison controls match baseline.
The harness started before commit creation and recorded main HEAD; source hashes
establish the actual tested implementation. See benchmark-summary.json.

Integration: retain PR #15 protected-net handling in shoveClear/ShoveCtx alongside
this terminal guard. PR #18 protects nudge separately; performance PR #17 changes
only lattice tests/evidence and has no function overlap.
