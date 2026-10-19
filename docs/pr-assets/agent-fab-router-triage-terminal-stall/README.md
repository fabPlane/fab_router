# Retained-copper search failure reduced from Q7–U2

`minimal.dsn` is a reduction of the completed hellscribe J1 seed-1 output:
two original surface pads (Q7.1 and U2.4), five tracks, six vias, two signal
layers, and the original outline and width/clearance rules. It has no pours,
keepouts, other pads or same-net intermediate copper. The original board is
public-domain licensed; LICENSE is preserved. `routed.dsn.gz` retains the
complete exported routed output, including its other two opens, as a control.
Neither fixture is a frozen benchmark input.

Both endpoint centers pass the exact full-width clearance predicate. With
unchanged production source the reduced fixture stops stagnant with one open,
zero engine DRC violations, no added copper and no timeout. A disposable source
copy changes only `MAX_POPS` in `src/route/passes.ts` from 30,000 to 240,000.
That copy completes the reduced fixture with five tracks and four vias, zero
engine violations, and every retained pad/track/via unchanged. This proves a
search-budget limitation on the reduction without requiring width or clearance
relaxation. The larger ceiling does not grant every search 240,000 pops: the
existing per-region limit remains in effect.

**The complete exported output still has three opens with the larger cap.**
Reduction preserves a routing failure but does not establish that the complete
board has the same sufficient cause. Its remaining obstruction/search mechanism
is unresolved. The larger cap is diagnostic evidence, not a proposed production
change, default recommendation or full-board completion fix.

Same host, cores 20–25, same fixture/rules, three repeats per mode:

| Engine diagnostic, each repeat | Before: original cap | After: cap-only copy |
| --- | ---: | ---: |
| Reduced fixture final opens | 1 | 0 |
| Reduced fixture final engine violations | 0 | 0 |
| Reduced fixture added tracks / vias | 0 / 0 | 5 / 4 |
| Complete exported output final opens | 3 | 3 |
| Complete exported output final engine violations | 0 | 0 |
| Changed retained pads/tracks/vias, either fixture | 0 | 0 |

Width is 250 um, ordinary clearance 200 um, edge clearance 500 um, hole
clearance 250 um, and via diameter/drill 600/400 um. No native rules, engine
source, adapter, checker or frozen case is edited. Results are engine-only:
there is no native import/refill validation of the successful reduced witness,
no full-board native improvement and no thermal-safety claim. In particular,
the known 27 added native thermal errors remain unresolved. The latest complete
native reference remains 39/78 passing attempts, 13/26 valid cases, 120 opens
and 27 errors; it was not rerun here. The three original native hellscribe J1
runs each had three opens and zero added errors.

Reproduce from the repository root with a **new** output directory:

```sh
taskset -c 20-25 nice -n 10 timeout 300 bun \
  docs/pr-assets/agent-fab-router-triage-terminal-stall/controls.ts \
  /tmp/terminal-search-budget-new
taskset -c 20-25 nice -n 10 timeout 900 bash -c \
  'bun run typecheck && bun run check:layers && bun run test'
python3 docs/pr-assets/agent-fab-router-triage-terminal-stall/chart.py
rsvg-convert -w 1600 \
  docs/pr-assets/agent-fab-router-triage-terminal-stall/comparison.svg \
  -o /tmp/terminal-search-budget.png
```

The control runner creates its cap-only source beneath the new output directory
and imports it there. It asserts known outcomes, absence of timeouts, endpoint
clearance, and byte-equivalent retained item objects. It is a known-failure
diagnostic, not a regression asserting a repaired production router. It retains
all twelve reports. The committed `results.json.gz` preserves their complete
JSON, including routed item geometry. `provenance.json` records the source native-board/export
hashes, full native reference entries, measured engine source hashes and the
one-line diagnostic change. Intermediates and reduction scripts are retained
under the cycle-157 agent scratch directory. The reduction greedily removes
parts, tracks, vias and pins while preserving the failure, then prunes unused
definitions; global minimality is not claimed.

Typecheck and layer checks pass; all 859 engine tests pass. No production
routing code is changed and no speed claim is made.

![Reduced retained copper and diagnostic route](https://github.com/fabPlane/fab_router/blob/agent/fab-router-triage-terminal-stall/docs/pr-assets/agent-fab-router-triage-terminal-stall/comparison.png?raw=true)
