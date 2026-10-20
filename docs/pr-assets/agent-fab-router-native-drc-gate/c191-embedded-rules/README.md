# Embedded board rule preservation

The native gate previously accepted a candidate that changed embedded solder-mask
clearance from 0.2 mm to zero while retaining identical project/custom rules. A small
outlined board has zero native findings and opens on both sides, so DRC comparison
alone cannot detect this policy change. The new preflight compares embedded setup
and physical layer definitions before invoking native checking.

The real native regression fails against `3a1d11e3` and passes after this fix.
Three same-machine repeats accept the changed-rule control before and block it after.
This is a rule-preservation improvement to the optional gate, not a thermal repair.
Footprint/pad/zone rules and general source fidelity remain outside this check.

The parser handles escaped native strings, rejects incomplete/multiple roots and
missing/duplicate setup/layer sections, normalizes numeric formatting, and protects
unknown setup fields. Native save adds default layer display aliases on some boards;
these aliases are excluded, but physical IDs/names/types/order are retained. All setup
children, including plot settings and their order, are compared conservatively.

```bash
git show 3a1d11e3:tools/native-drc-gate.ts > /tmp/gate-before.ts
bun docs/pr-assets/agent-fab-router-native-drc-gate/c191-embedded-rules/controls.ts \
  /tmp/gate-before.ts /tmp/embedded-before
bun docs/pr-assets/agent-fab-router-native-drc-gate/c191-embedded-rules/controls.ts \
  "$PWD/tools/native-drc-gate.ts" /tmp/embedded-after
bun test test/native-drc-gate.test.ts test/kicad-board-rules.test.ts
bun run typecheck && bun run check:layers && bun run test
python3 docs/pr-assets/agent-fab-router-native-drc-gate/measure.py \
  --prior /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c188/final-run \
  --source "$PWD" --out /tmp/native-embedded-rules
python3 docs/pr-assets/agent-fab-router-native-drc-gate/verify.py /tmp/native-embedded-rules
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c190-connectivity/verify.py \
  /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c190/native-run \
  /tmp/native-embedded-rules
```

Full-suite compatibility uses the same retained 26 cases × 3 seeds on cores 20–25,
native checker 10.0.6. Routing is not rerun. Fresh native reports and source hashes
are retained for independent replay; native connectivity witness differences are
recorded rather than requiring byte-identical reports.

Final result: 69/78 accepted and 9/78 rejected before and after; all 27 added thermal
errors detected; 120 underlying opens. All 78 decisions, source hashes, native policy,
error findings and open counts match the prior retained run. Routing remains 39/78
passes and 13/26 cases passing 3/3. The measurement tool session returned status 143
after writing the complete 78-row results and final summary. All 156 reports are present
and independent replay of both the original and extracted archive passes; no row is
missing or excluded. `measurement-process.json` retains that process observation.

Initial fixture omitted the outline: its inherited outline error was identical on
both sides. Those three native pairs are retained separately as preliminary controls,
excluded from the outlined-control table. The first suite attempt compared display
aliases too strictly and stopped at the first preflight, before any native invocation.
Its log/signatures are retained; the final full suite uses the corrected comparison.
An initial parser test exposed acceptance of adjacent quoted tokens; the parser now
requires a separator after a quoted string. Earlier full-check log was superseded
after adding the alias regression; final checks use the final tree.

Final verification: typecheck and layer boundaries pass; 875 tests, zero failures,
398505 assertions. The focused 16 tests also pass.
