# Route reports use resolved clearance rules

The driver passed no options to either DRC snapshot, even when routing used
explicit hole or copper-to-edge clearance settings. Its initial/final report
therefore measured a different rule set. Both snapshots now receive the resolved
settings, including enabled file settings and explicit caller overrides.

Four small regressions fail against base `69cf598db98c136bff16bbe02bccdded95674b18`
and pass after the fix. They cover stricter edge clearance, an explicit zero edge
rule, the final-board sweep, file hole clearance and caller precedence. The final
sweep test changes the board in a caller hook to exercise report measurement;
it does not claim the router itself generated that bad geometry.

The benchmark compares all 26 frozen cases and all three seeds on `hyper-ms-lin`,
cores 20–25, native checker 10.0.6. No input, scoring, checker, adapter, or runtime
changes are made. Each input report is independently compared with direct DRC
using its recorded effective settings. This is internal model consistency, not a
claim that the internal checker implements native thermal validation.

| Same 26 cases, three repeats each | Before | After |
| --- | ---: | ---: |
| Input report mismatches with effective-rule direct DRC | 18 / 78 | 0 / 78 |
| Passing native runs | 39 / 78 | 39 / 78 |
| Cases passing 3/3 | 13 / 26 | 13 / 26 |
| Native opens | 120 | 120 |
| New native thermal errors | 27 | 27 |
| Median full route-path seconds | 1.061 | 1.067 |

Affected cases, three repeats each; native totals include all three attempts:

| Case | Initial internal count before → after (each seed) | Native passes before → after | Native opens before → after | New native errors before → after |
| --- | ---: | ---: | ---: | ---: |
| fan-controller-fan-controller-j2-large | 0 → 10 | 3/3 → 3/3 | 0 → 0 | 0 → 0 |
| fan-controller-fan-controller-j2-medium | 0 → 10 | 3/3 → 3/3 | 0 → 0 | 0 → 0 |
| fan-controller-fan-controller-j2-small | 0 → 10 | 0/3 → 0/3 | 3 → 3 | 0 → 0 |
| hellscribe-hellscribe-j2-large | 0 → 4 | 0/3 → 0/3 | 3 → 3 | 0 → 0 |
| qrpcard-qrpcard-j2-medium | 0 → 4 | 3/3 → 3/3 | 0 → 0 | 0 → 0 |
| qrpcard-qrpcard-j2-small | 0 → 4 | 0/3 → 0/3 | 0 → 0 | 6 → 6 |

All 78 sessions are byte-identical, and every paired native outcome, fidelity
result, via count and copper length is unchanged. The corrected 18 reports span
six retained-copper cases and previously omitted 126 inherited internal findings.
For the three fan-controller retained-copper cases the initial count is now 10;
for the large retained-copper hellscribe case and medium/small retained-copper
qrpcard cases it is now 4. Each agrees in all three seeds. These are model findings
under the configured hole rule, not claims about native baseline errors.

Validation: typecheck and layer checks pass; **863 tests pass, 0 fail**, with
398469 assertions (219.98 seconds). All four new regressions fail on the base.


Native thermal failures remain unresolved. This reporting correction does not
claim a routing or speed improvement. Full raw native evidence is retained in the
agent scratch directory; committed per-attempt results, controls, audits, source
hashes and logs retain the measurement and provenance. `comparison.json` records
all paired attempts, report values and session hashes. `compare.py` rejects any
change in outcomes, fidelity, geometry metrics or returned session bytes.

Reproduce from the candidate repository root with the integration checkout at
`/home/hyper/bench/wt/fp-bugs` (stock local benchmark runtime already installed).
Use fresh output and control-worktree directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-report-clearances
S=/tmp/report-clearance-comparison
mkdir -p "$S"
git worktree add -b agent/report-clearance-control "$S/before-source" 69cf598db98c136bff16bbe02bccdded95674b18
FP=/home/hyper/bench/wt/fp-bugs
(cd "$FP" && taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$S/before-source" --out "$S/before")
(cd "$FP" && taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out "$S/after")
taskset -c 20-25 nice -n 10 timeout 120 bun "$R/audit.ts" "$PWD/src/api.ts" "$S/before" > "$S/before-audit.json"
taskset -c 20-25 nice -n 10 timeout 120 bun "$R/audit.ts" "$PWD/src/api.ts" "$S/after" > "$S/after-audit.json"
python3 "$R/compare.py" --before "$S/before" --after "$S/after" --before-audit "$S/before-audit.json" --after-audit "$S/after-audit.json" --out "$S/comparison.json"
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Report accuracy and native benchmark outcomes](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-report-clearances/docs/pr-assets/agent-fab-router-fix-report-clearances/comparison.png?raw=true)
