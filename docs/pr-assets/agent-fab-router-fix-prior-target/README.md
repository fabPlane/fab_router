# Prior attachment targets must touch filled copper

The outline vertex average can be inside a hole or outside a concave outline.
Routing successfully to that point does not necessarily touch the Prior region.
The driver previously returned success after adding a short, disconnected track.
The fix keeps the centroid candidate only if the existing exact pour predicate
confirms that the point touches filled copper. The nearest outline vertex remains
available, with unchanged clearance, width, item, cancellation and time policies.

The original four-pad fixture is hand-built. Both geometries and both endpoint
orientations fail on main and pass with the fix. Each assertion set runs three
times. The regression preserves the pads, Prior region and retained obstacle,
checks zero added violations and no vias, then verifies journal rollback. The
six measured routes per version (two shapes, three repeats) are in before.json
and after.json. Each also records a fresh public route() run: the same
one-open to zero-open improvement, with zero engine violations. validate.py
asserts those outcomes and preservation. The image renders measured records directly.

From the repository root:

```bash
bun test test/prior-target.test.ts
bun run docs/pr-assets/agent-fab-router-fix-prior-target/audit.ts
python3 docs/pr-assets/agent-fab-router-fix-prior-target/validate.py
python3 docs/pr-assets/agent-fab-router-fix-prior-target/render.py
bun run typecheck && bun run check:layers && bun run test
```

To reproduce the failing baseline without changing this checkout:

```bash
mkdir -p /tmp/prior-target-baseline
git archive 69cf598 | tar -x -C /tmp/prior-target-baseline
cp test/prior-target.test.ts /tmp/prior-target-baseline/test/
cp test/helpers/prior-target.ts /tmp/prior-target-baseline/test/helpers/
mkdir -p /tmp/prior-target-baseline/docs/pr-assets/agent-fab-router-fix-prior-target
cp docs/pr-assets/agent-fab-router-fix-prior-target/audit.ts /tmp/prior-target-baseline/docs/pr-assets/agent-fab-router-fix-prior-target/
(cd /tmp/prior-target-baseline && bun test test/prior-target.test.ts)
(cd /tmp/prior-target-baseline && bun run docs/pr-assets/agent-fab-router-fix-prior-target/audit.ts)
```

The baseline test command must fail four tests; the audit records one remaining
open per route despite a true driver return. The candidate has zero opens on
both fixtures. This engine regression does not establish native thermal safety.

Native full nonregression command (from the integration checkout):

```bash
taskset -c 20-25 nice -n 10 timeout 3000 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c34-after-full
```

Validate all 78 outcomes, comparison controls and source hashes:

```bash
python3 docs/pr-assets/agent-fab-router-fix-prior-target/summarize.py /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c34-after-full --source HEAD --out docs/pr-assets/agent-fab-router-fix-prior-target/benchmark-summary.json
```

This change is independent of the live-connectivity fix in PR #24. Preserve
both changes when integrating: one validates the partner component, the other
validates the geometric attachment target.

Targeted composition check: archived 2c78431 plus the source-only diff
69cf598..9963847 in passes.ts, with both regression files and helpers.
All seven tests passed on each of three repeats; see composed-regressions.json.
This is not a full composed-suite or native-benchmark claim.

Full native fab_router run: same 26 frozen cases, three repeats each, same host and cores 20–25. Inputs, settings, checker, runtime, seeds and order match; all 74 source hashes match the stated revisions. Every case/seed has identical pass, open, error, via and length outcomes.

| Native measurement | Main 69cf598 | Candidate 2c78431 |
| --- | ---: | ---: |
| Passed attempts | 39/78 | 39/78 |
| Cases valid 3/3 | 13/26 | 13/26 |
| Opens | 120 | 120 |
| New native DRC errors | 27 | 27 |
| Median route seconds | 1.172079 | 1.132183 |

All 27 errors are starved_thermal. Native completion and thermal outcomes are
unchanged. Shared-host timing is descriptive only; no speed improvement claimed.

Cycle 35 adds a positive control for the two-way attachment branch: neither
terminal initially belongs to the Prior region's component, and a retained wall
blocks direct probes. Both endpoint orientations must finish with both terminals
in the region's component, zero violations and no vias. Rewinding the journal
must restore exactly the retained track and the original open connection.
These controls pass on main and candidate; they establish preservation of the
two-leg path, not another fixed failure. Across three repeats per version, the
expanded suite reports main 2 pass / 4 fail and candidate 6 pass / 0 fail every
time; raw logs are in two-way-regressions.json. Run the same test command above.
Production source is unchanged from 2c78431, so the existing exact-source native
sweep remains applicable; no new native benchmark or timing claim is made.
