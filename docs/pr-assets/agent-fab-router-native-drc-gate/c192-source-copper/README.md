# Preserve original routing copper

An outlined native-clean control contains one original unassigned track. Removing it
leaves both native reports clean with zero opens, so the old gate accepted the deletion
in all three repeats. The new preflight blocks it before native execution in all three.
This is preservation of existing routing items, not a thermal geometry repair or a
complete source-fidelity certificate. Pads, zones and external dependencies remain
outside this preservation check.

The check compares the multiset of original board-level segments, arcs and vias,
including physical fields. UUIDs are ignored because session import regenerates them;
track/arc endpoint direction is ignored because copper is undirected. Numeric formatting and named field order are
normalized. Additional routes are permitted. Equivalent splitting and changed original
copper are conservatively rejected. Regression coverage includes deletion, movement,
width/net changes, duplicates, added routes, numeric formatting, vias and arcs.

Reproduce from the repository root (outputs must not exist):

```bash
git show 9cd27f06:tools/native-drc-gate.ts > /tmp/before-gate.ts
git show 9cd27f06:tools/kicad-board-rules.ts > /tmp/kicad-board-rules.ts
bun docs/pr-assets/agent-fab-router-native-drc-gate/c192-source-copper/controls.ts /tmp/before-gate.ts /tmp/copper-before
bun docs/pr-assets/agent-fab-router-native-drc-gate/c192-source-copper/controls.ts tools/native-drc-gate.ts /tmp/copper-after
bun test test/native-source-copper.test.ts test/native-drc-gate.test.ts
bun run typecheck && bun run check:layers && bun run test
python3 docs/pr-assets/agent-fab-router-native-drc-gate/measure.py --prior /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c188/final-run --source "$PWD" --out /tmp/copper-native-run
python3 docs/pr-assets/agent-fab-router-native-drc-gate/verify.py /tmp/copper-native-run
```

`regression-before.log` records the initially missing new export; `runner-before.log`
records the existing runner reaching native execution rather than enforcing source
preservation. That minimal parser fixture was intentionally not a valid native board.
`native-regression-before.log` repeats the final valid outlined regression against
the old gate: it fails because the promise resolves (deletion accepted). The three
outlined native-clean controls provide the actual before/after acceptance measurement. Complete reports and fixture bytes are retained in the archive.

The first suite attempt stopped after four native pairs because its comparison included
UUIDs. Inspection showed native session import regenerated UUIDs and reversed some
undirected segments. No physical source change was found. The rejected initial run and
all eight reports are retained separately; final preflight passes all 78 candidates.

Final retained suite: 69/78 accepted, 9/78 rejected; all 27 added thermal errors
detected and 120 underlying opens. All 78 decisions, source hashes, policy and error
findings match cycle191; 13 native open-endpoint witness differences are retained.
Routing was not rerun. Underlying score remains 39/78 passes, 13/26 cases passing 3/3.
Independent report replay and paired comparison pass.

Final required checks: typecheck and layer boundaries pass; 881 tests, zero failures,
398518 assertions, 226.88 seconds. Focused final coverage: 18 tests pass.
