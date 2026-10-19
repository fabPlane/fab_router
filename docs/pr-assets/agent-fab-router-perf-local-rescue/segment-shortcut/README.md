# Isolated segment threshold shortcut

The candidate preserves the original core construction and radius addition order,
then short-circuits segment comparisons after intersection or the first accepting
endpoint distance. Its finite coordinate guard bounds each coordinate by 2^25;
all other inputs use the original distance computation. Strict clearance and
inclusive touching retain separate comparisons. Production source, defaults and
the consumer pin are unchanged: the candidate exists only in this evidence
archive and generated scratch trees.

This follows the complete-board threshold census, which found potentially
avoidable endpoint evaluations but did not predict runtime. Extra guards,
closures, dispatch and other work can outweigh fewer distance evaluations.
The measured times are complete engine replays, including routing, exact checks
and report generation. They exclude native import/refill/check and do not measure
full-suite speed, native DRC quality, allocation or JIT effects.

**Negative prerequisite:** all three candidate replays are slower. Median time is
54.899422 → 56.357422 seconds (+2.66%); maximum time is
55.179078 → 57.913392 seconds (+4.96%). The shortcut remains isolated.
No reliable speed gain or guard/closure cost attribution is claimed.

See [the timing table](table.md), [raw summary](summary.json) and
[chart](timing.png). Three sequential alternating original/candidate pairs use
the same archived complete input and effective settings on cores 12–19. No
routing attempt is discarded or rerun. Both isolated trees also run the required
typecheck, layer checks and full unit suite. Both isolated gates and the final production-checkout gate pass typecheck,
layer checks (71 files, zero violations), and 912 tests / 399,733 assertions.
Supervisor status is retained in `supervisor.json`. The independent source
preparation is byte-identical (`preparation.json`).

All six sessions, final statistics, settings and reports (excluding only elapsed
time) must match the independent archived native-workload control. Recovery logs
must match excluding only nested seconds. The native thermal findings in that
historical workload remain unresolved; these six engine replays perform no new
native check and make no native-quality gain claim. A separate fresh full native
comparison is recorded in [segment-native](../segment-native/README.md).

`equivalence.ts` checks 260,369 API comparisons against the isolated original,
including radii, strict equality boundaries, pieces, line boxes, reversed and
degenerate segments, coordinate boundaries and fallback inputs. This is finite
empirical coverage, not a proof for every input. An inclusive-for-strict mutation
is rejected. `verify.py` separately rejects six record and three source
corruptions. The audit checks all 1,536 implementation/specification/test files
against the independent source inventory; only `src/route/clear.ts` differs.

Reproduce from repository root with an unused scratch path:

```sh
p=docs/pr-assets/agent-fab-router-perf-local-rescue/segment-shortcut
s=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/segment-shortcut-repro
python3 "$p/prepare.py" "$s/work"
taskset -c 12-19 nice -n 10 timeout 60 bun "$p/equivalence.ts" "$s/work/original" "$s/work/candidate" > "$s/equivalence.json"
python3 "$p/mutation.py" "$s"
python3 "$p/run.py" "$s"
PYTHONDONTWRITEBYTECODE=1 python3 "$p/collect.py" "$s" "$s/report"
python3 "$p/report.py" "$s/report"
```

Verify the committed archive without routing:

```sh
p=docs/pr-assets/agent-fab-router-perf-local-rescue/segment-shortcut
PYTHONDONTWRITEBYTECODE=1 python3 "$p/verify.py" /tmp/segment-shortcut-summary.json
cmp /tmp/segment-shortcut-summary.json "$p/summary.json"
python3 "$p/report.py" "$p"
rsvg-convert -w 1000 "$p/timing.svg" -o /tmp/segment-shortcut-timing.png
```

Any production adoption requires favorable prerequisite timing and fresh paired
full 26×3 native per-case median/p95/total speed and quality comparisons, plus
the dense input, ladder L2/L3 and enabled slow acceptance checks. Historical
full-native tables in the PR apply to the earlier slot-reference experiment.
