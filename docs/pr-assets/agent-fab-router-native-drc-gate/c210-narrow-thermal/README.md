Cycle 210: isolate narrow axial thermal geometry with a complete-net control

The existing reduced Aquarius fixture adds one signal track to its complete source board. Eighteen fresh endpoint-preserving offset probes were checked with unchanged native acceptance tools. Six positive offsets (0.055, 0.060, 0.065, 0.070, 0.072, 0.073 mm) eliminate the thermal and preserve ownership and source/routed terminal pairs. All retain 111 opens against the 110-open source budget, so every probe is rejected. Negative offsets retain starvation; larger positive offsets cause clearance/mask errors or native net reassignment. These are sampled offsets, not a proof of a continuous legal interval.

The remaining open is an isolated signal-copper island: the native missing-connection witnesses link the detour to U1.40 and C1.1. This signal net has two native opens before and three after, while all source/routed terminal pairs remain intact. The added-copper minimizer removed the surrounding routed backbone; future repairable witnesses must retain that backbone rather than relaxing the source open budget.

The selected 0.060 mm candidate repeats identically in three further native-gate checks. An independent native refill/save and Decimal copper inventory confirm exact physical copper and net ownership preservation. This establishes local thermal geometry only. It does not repair the full benchmark case, pass the source open budget, change production proposals, or improve routing scores. The added regression explicitly preserves rejection on the independent open budget. No fail-first production fix is claimed.

Same machine (hyper-ms-lin), affinity 20–25, native 10.0.6:

| Same reduced fixture | Repeats | New errors | Opens | Native ownership | Accepted |
|---|---:|---:|---:|---|---:|
| Prior 0.2637 mm first proposal, retained cycle209 | 3 | 0 | 110 | changed | 0/3 |
| Narrow 0.060 mm diagnostic, fresh cycle210 | 3 | 0 | 111 | preserved | 0/3 |

A second complete-board control retains ALL nine generated items on this signal net from the retained routed output. Before the detour, it has one thermal error and 109 opens. The same 0.060 mm detour yields zero errors, 109 opens, zero lost source/routed pairs, and preserved native net ownership: accepted three times, with an exact checked candidate published once. This is a safe manually constructed local control, not an automatic-search or full Aquarius fix. No proposal generator changes are shipped.

| Same complete-net control, fresh paired measurements | Repeats | New thermal errors | Opens | Ownership | Accepted |
|---|---:|---:|---:|---|---:|
| Original nine-item signal net | 3 | 1 | 109 | preserved | 0/3 |
| Narrow detour, other eight items unchanged | 3 | 0 | 109 | preserved | 3/3 |

No router rerun. Last full optional run (cycle206): 45/78 passes, 15/26 cases valid 3/3, 120 opens, 18 thermal errors. Last default full run (cycle203): 39/78 passes, 13/26 valid, 120 opens, 27 thermal errors. These historical scores remain unresolved, not remeasured here.

Reproduce the regression and required checks from the engine checkout:

```sh
taskset -c 20-25 nice -n 10 timeout 180 bun test test/native-aquarius-thermal.test.ts --test-name-pattern 'narrow report-clean|complete signal backbone'
taskset -c 20-25 nice -n 10 timeout 1800 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Replay all retained evidence (no native execution required):

```sh
asset=docs/pr-assets/agent-fab-router-native-drc-gate/c210-narrow-thermal
mkdir -p /tmp/c210-replay
tar -xJf "$asset/native-evidence.tar.xz" -C /tmp/c210-replay
python3 "$asset/verify.py" /tmp/c210-replay
```

Fresh complete 18-probe sweep, using archived exact native tools/fixtures:

```sh
bun "$asset/reproduce.ts" /tmp/c210-replay/runtime /tmp/c210-fresh-probes
bun "$asset/reproduce-backbone.ts" /tmp/c210-replay/runtime /tmp/c210-fresh-probes
```

Use a new output directory. Native KiCad 10.0.6, its Python module, and Bun are required. Every attempt is retained. The original broad and narrow scripts/raw logs are included; `reproduce.ts` combines their geometry into one sequential sweep. Fresh UUIDs and native report timestamps may differ. No timing claim; checks overlapped the unit suite on the same allowed cores.

`verify.py` checks all 18 retained decisions and counts, three selected repeat checks, independent exact Decimal copper comparison, six paired complete-net decisions and the byte-exact published candidate. `comparison.png` shows all positive samples; six negative samples remain in the archive. Source hashes and provenance identify unchanged measured tools. `initial-typecheck-failed.log` discloses an optional-field typing error corrected before running the full suite.

Final required checks: typecheck PASS; layer check 65 files / zero violations; full suite 922 pass / zero fail / 398,840 assertions / 796.33 seconds. Both final new tests are present in the complete suite log. Focused checks: isolated budget regression 11 assertions PASS, complete-net control 17 assertions PASS. Final static checks also pass. Original and extracted-archive independent replay outputs are byte-identical.

The top-level probe summaries omit nested duplicate report objects; all original complete summaries and raw per-probe reports are retained byte-for-byte in the archive.
