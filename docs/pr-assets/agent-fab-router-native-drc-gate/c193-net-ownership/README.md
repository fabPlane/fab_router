# Preserve electrical net ownership

The optional native acceptance gate previously compared numeric copper net fields
without preserving the board-level net ID-to-name mapping. An outlined board with
one track on net 1 was accepted after renaming that net from GND to VCC. Both native
reports have zero errors and zero opens; their dangling-track warning is retained.
The copper, outline, setup and project rules are otherwise byte-identical.

The existing native-runner regression fails against a1ea22c0 because the changed
candidate is accepted. The fix compares the complete net table before native
execution. It permits numeric formatting and table reordering; renamed, exchanged,
added, removed or renumbered nets block acceptance. Duplicate IDs/names and malformed
declarations fail closed. This is a conservative ownership guard, not a complete
source-fidelity validator or a thermal geometry repair.

Same host, cores 20–25, native checker 10.0.6:

| Measurement | Before | After | Repeats |
|---|---:|---:|---|
| Changed net ownership blocked | 0/3 | 3/3 | Same outlined control, three repeats |
| Retained candidate decisions | 69 accept / 9 reject | 69 accept / 9 reject | 26 cases × three seeds |
| Added thermal errors detected | 27 | 27 | 26 cases × three seeds |
| Underlying routing passes | 39/78 | 39/78 | Retained suite; routing not rerun |
| Underlying cases passing 3/3 | 13/26 | 13/26 | Retained suite |
| Underlying opens | 120 | 120 | Retained suite |

Reproduce from the repository root. Output directories must not already exist:

```bash
mkdir -p /tmp/net-ownership-control
git show a1ea22c0:tools/native-drc-gate.ts > /tmp/net-ownership-control/native-drc-gate.ts
git show a1ea22c0:tools/kicad-board-rules.ts > /tmp/net-ownership-control/kicad-board-rules.ts
bun docs/pr-assets/agent-fab-router-native-drc-gate/c193-net-ownership/controls.ts /tmp/net-ownership-control/native-drc-gate.ts /tmp/net-before
bun docs/pr-assets/agent-fab-router-native-drc-gate/c193-net-ownership/controls.ts tools/native-drc-gate.ts /tmp/net-after
bun test test/native-board-nets.test.ts test/native-source-copper.test.ts test/native-drc-gate.test.ts
bun run typecheck && bun run check:layers && bun run test
python3 docs/pr-assets/agent-fab-router-native-drc-gate/measure.py --prior /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c188/final-run --source "$PWD" --out /tmp/net-native-run
python3 docs/pr-assets/agent-fab-router-native-drc-gate/verify.py /tmp/net-native-run
```

The original complete routing suite is retained on the benchmark host. The committed
native archive supports independent report replay without that private scratch path:

```bash
mkdir /tmp/net-evidence
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c193-net-ownership/native-evidence.tar.xz -C /tmp/net-evidence
python3 docs/pr-assets/agent-fab-router-native-drc-gate/verify.py /tmp/net-evidence/native-run
```

No route search, benchmark input, native checker or scoring was changed. This optional
command remains outside the automatic benchmark/editor path. The nine unsafe routing
outputs and their 27 thermal errors remain unresolved; rejection is not a routing gain.

Final validation: typecheck and layer checks pass; 885 tests, zero failures,
398538 assertions (259.62 seconds). Independent replay passes for all 78 decisions.
All source hashes, native error findings, policies and open counts match cycle192;
14 candidate connectivity endpoint-witness differences are recorded in comparison.json.
No measurement attempt was omitted.
