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

Cycle 25 adds two pour-specific regression controls (three repeats per version on
this same host/core set). On main, the non-prior interior pour detaches; the fixed
implementation rejects the shove and restores the track, journal and live index.
A prior helper pour is deliberately excluded from terminal membership: both
versions allow the shove, keep endpoint pads connected and permit insertion of
the wanted track with zero spacing violations. Rewinding that successful trial
restores the original attachment and records. These controls distinguish real
pour terminals from connectivity helper geometry.

| Terminal regression file, each of three repeats | Main | Fixed |
| --- | ---: | ---: |
| Passed tests | 1 | 4 |
| Failed tests | 3 | 0 |
| Interior pour preserved | no | yes |
| Prior helper safe shove and caller rewind | pass | pass |

Run `python3 docs/pr-assets/agent-fab-router-fix-shove-terminals/baseline-regression.py`
for the main comparison (expected exit 1; current terminal file has four regression failures), then
`bun test test/shove-terminals.test.ts` for the fixed version. Both commands can
be repeated three times. No production source changed in this follow-up; the
cycle-24 native sweep above still covers the exact same engine source. No new
native sweep or completion/thermal improvement is claimed.

Final cycle-25 verification: typecheck and layer checks pass; 864 tests pass,
zero failures, 398497 assertions (205.50 seconds). This cycle also corrects
readonly-array setup/assertion errors in the previously committed cascade test.
The previous cycle's all-checks-pass claim did not describe that committed test
accurately; these fresh checks verify the final test files. No production change.


Cycle 26 adds a two-layer connection: a locked via joins the movable front track
interior to a held back track and a back pad. Main accepts the displacement and
loses this pad connection; the fixed implementation rejects it. A via placed at
the track's fixed endpoint is a positive control: both versions accept the shove,
keep the back pad connected and allow DRC-clean insertion of the requested track.
Both tests compare live and rebuilt connectivity, immutable via/back-track records,
and caller rewind. The rejected trial must restore the journal before caller rewind.

| Same terminal file, three repeats per version | Main 69cf598 | Fixed |
| --- | ---: | ---: |
| Tests passed per repeat | 2/6 | 6/6 |
| Interior via/back-pad preservation regression | fail | pass |
| Endpoint via safe shove and caller rewind | pass | pass |

The combined shove suite passes 15/15 each repeat. Commands above reproduce these
results; `via-regressions.json` records commands, repeated results and log hashes.
All 80 tracked engine/type files still match b23a9da. This follow-up changes tests
and evidence only; it reuses the exact-source native sweep above and makes no new
native completion, thermal or timing claim.

Final cycle-26 checks: typecheck passes; 65 files/zero layer violations;
866 tests pass, zero failures, 398581 assertions (212.65 seconds).
The initial check run was stopped after strengthening a rollback assertion;
these final checks cover the final test source.
