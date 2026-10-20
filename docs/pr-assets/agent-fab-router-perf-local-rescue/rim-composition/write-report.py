from pathlib import Path
import json
w=Path(__file__).resolve().parent;root=Path('/home/hyper/bench/wt/fr-perf');out=root/'docs/pr-assets/agent-fab-router-perf-local-rescue/rim-composition'
s=json.loads((out/'summary.json').read_text());a,b=[s['summary'][m]for m in ['before','after']];dense=json.loads((out/'dense-comparison.json').read_text());ladder=json.loads((out/'ladder-summary.json').read_text());commit=(w/'engine-commit.txt').read_text().strip()
change=lambda k:100*(b[k]/a[k]-1)
text=f'''Adds optional bounded recovery for connections left open after normal routing, guarded by original-terminal connectivity, retained copper and exact represented-rule DRC checks. Late, cancelled or invalid trials roll back. Recovery stays **off by default**.

The latest increment reuses the existing PR #4 allocation-free rim traversal on the current ring/recovery source: walk existing shape parts and rings directly instead of allocating filtered cutouts, flattened parts and sliced probe arrays. Probe order, exact predicates, physical rules, widths, lattice and search settings stay unchanged. Production delta from `49bfc72a` is only `src/geom/onboard.ts`, with the existing 42,048-decision differential guard added. Implementation: `{commit}`.

Fresh native comparison: same frozen **26 cases × 3 repeats**, same host, cores 12–19/nice 10, candidate sweep then control sweep, identical enabled recovery, no overlapping own heavy jobs. **All 78 paired sessions, statistics and full reports except wall time match.** Native findings and warning geometry, opens, fidelity, vias and length do not regress. Both retain **27 known router-introduced native thermal errors**, unresolved.

Observed total route change **{change('total_s'):+.2f}%**, overall median {change('median_s'):+.2f}%, overall p95 {change('p95_s'):+.2f}%, sweep wall {change('wall_s'):+.2f}%. Only **12/26 case medians and 18/26 case p95 improve**; individual regressions remain below. Timing on this shared host is observational and does not establish universal or causal speedup.

'''+(out/'aggregate-table.md').read_text()+'''
![All case medians, including regressions](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/rim-composition/timings.png?raw=true)

'''+(out/'table.md').read_text()
da,db=[dense['summary'][m]for m in ['before','after']]
text+=f'''
Dense6: three alternating pairs, fixed two-pass/600s budgets, all six sessions/statistics identical. Each has 181 opens, zero new native errors, 315 vias and 2317.561458 mm length. Median {da['median_s']:.6f}→{db['median_s']:.6f}s ({100*(db['median_s']/da['median_s']-1):+.2f}%); p95 (max of 3) {da['p95_s']:.6f}→{db['p95_s']:.6f}s. This custom board is outside the frozen-suite score.

| Ladder (one pair each; engine replay only) | Before s | After s | Engine incomplete (both) |
|---|---:|---:|---:|
'''
for r in ladder:text+=f"| {r['case']} | {r['before_s']:.6f} | {r['after_s']:.6f} | {r['engine_incomplete']} |\n"
text+='''
Ladder sessions, settings, statistics and reports except wall match, with zero added represented-rule violations and no timeouts. These are not fresh native DRC scores.

Validation: typecheck and layer checks pass; **914 tests / 649747 assertions / zero failures**, including the added differential traversal test and unchanged route fingerprints. The first isolated typecheck attempt failed because the snapshot omitted documentation fixtures imported by existing tests. Restoring the unchanged fixtures from the control revision fixed the setup; both logs and the fixture hash audit are retained. No expectations or scoring changed.

'''+(out/'profile-table.md').read_text()+'''
One separately profiled route per version, with matching output; profiled times are excluded from timing aggregates. Inlining moves attribution between traversal and helper functions, so sampled self time is not a causal CPU-cost estimate.

**Prior limitations remain:** cache-only speed benefit is unsupported (a previous warmed median regressed 9%; a reverse full pair had median +0.15%, p95 +4.07%, total −0.66%). Earlier ring composition had adverse dense/ladder timings. The prior complete enabled slow acceptance was 51 pass/12 existing failures across 63 cases, but its historical 300-second case increased 18→19 incompletes; three fresh isolated pairs then gave 18/18 in every pair. The cause remains unproven. That whole slow suite is **not rerun in this cycle**. No universal, whole-slow-suite or live-editor nonregression claim is made. [Prior evidence and retained adverse attempts](../ring-composition/README.md), [cache replication](../quilt-counterbalanced/README.md).

Reproduce with dependencies installed and the private benchmark runtime already prepared:

```bash
ENGINE=/home/hyper/bench/wt/fr-perf
ASSET="$ENGINE/docs/pr-assets/agent-fab-router-perf-local-rescue/rim-composition"
RUN=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/rim-composition-repro
'''+f'''python3 "$ASSET/prepare-repro.py" "$ENGINE" "$RUN" 49bfc72a {commit}
'''+'''python3 "$RUN/native.py"
python3 "$RUN/checks.py"
python3 "$RUN/stress.py"
python3 "$ASSET/verify.py"
python3 "$ASSET/verify-dense.py"
```

The stress supervisor runs separate profiles, three alternating dense pairs and one pair each of ladder L2/L3, on cores 12–19/nice 10 with individual timeouts. The dense fixture is `/home/hyper/bench/boards/dense/fab_pcb-case-dense6-bga324-j1`; ladder inputs are `/home/hyper/bench/boards/ladder/{l2,l3-cycle18}.dsn`. Payloads, settings, native records and original licensing/provenance are archived. Verifiers rebuild all native/stress comparisons and derived tables/chart; four native and two dense corruption controls must fail. All attempts are retained.

The source-override benchmark exercises the standalone export/import and engine API. It does not validate the consumer package exporter or live-editor latency. Consumer pin follow-up: https://github.com/fabPlane/fab_pcb/pull/38 .

Retained recovery witness (the latest traversal increment changes no copper):

![Previously closed connection with native checks](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/point-components/connection.png?raw=true)

[Bounded recovery design and exact rollback gates](../point-components/README.md).
'''
(out/'README.md').write_text(text)
# GitHub PR relative links resolve from the repository root, so use explicit blob destinations.
body=text.replace('(../','(https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/')
(w/'pr-body.md').write_text(body)
print('PASS wrote current report and PR description')
