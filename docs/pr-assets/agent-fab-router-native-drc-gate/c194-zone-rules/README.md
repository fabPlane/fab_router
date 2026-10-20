# Preserve authored zone rules

The optional native gate previously accepted a candidate with changed zone thermal
rules when both reports were native-error-free. A minimal outlined control changes
only thermal_gap from 0.3 to 0.1 mm. The old gate accepts it three times; the corrected
gate blocks it before native execution three times. Both old native reports contain
zero errors and opens, plus the same isolated-copper warning.

The native-runner regression fails against 925dc811 because the promise resolves.
The fix compares authored zone definitions as a multiset, including thermal gaps,
spoke widths, clearances, connection modes, geometry, ownership and keepout rules.
It permits changed UUIDs and derived filled_polygon/filled_segments caches, numeric
formatting and top-level named field/zone reordering. Nested rule and polygon vertex
order are retained conservatively. Unknown authored fields are protected. This does
not repair thermal geometry or establish complete design fidelity/editor atomicity.

Same host hyper-ms-lin, cores 20–25, native checker 10.0.6:

| Measurement | Before | After | Repeats |
|---|---:|---:|---|
| Changed thermal-rule control blocked | 0/3 | 3/3 | Same fixture, three repeats |
| Retained candidate decisions | 69 accept / 9 reject | 69 accept / 9 reject | 26 cases × three seeds |
| Added thermal errors detected | 27 | 27 | 26 cases × three seeds |
| Underlying routing passes | 39/78 | 39/78 | Retained suite; router not rerun |
| Underlying cases passing 3/3 | 13/26 | 13/26 | Retained suite |
| Underlying opens | 120 | 120 | Retained suite |

Reproduce from the repository root; output directories must not already exist:

```bash
mkdir -p /tmp/zone-control
git show 925dc811:tools/native-drc-gate.ts > /tmp/zone-control/native-drc-gate.ts
git show 925dc811:tools/kicad-board-rules.ts > /tmp/zone-control/kicad-board-rules.ts
bun docs/pr-assets/agent-fab-router-native-drc-gate/c194-zone-rules/controls.ts /tmp/zone-control/native-drc-gate.ts /tmp/zone-before
bun docs/pr-assets/agent-fab-router-native-drc-gate/c194-zone-rules/controls.ts tools/native-drc-gate.ts /tmp/zone-after
bun test test/native-board-zones.test.ts test/native-drc-gate.test.ts
bun run typecheck && bun run check:layers && bun run test
python3 docs/pr-assets/agent-fab-router-native-drc-gate/measure.py --prior /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c188/final-run --source "$PWD" --out /tmp/zone-native-run
python3 docs/pr-assets/agent-fab-router-native-drc-gate/verify.py /tmp/zone-native-run
```

The retained complete routing suite is available on the benchmark host. The committed
native archive supports independent report replay without the private scratch path:

```bash
mkdir /tmp/zone-evidence
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c194-zone-rules/native-evidence.tar.xz -C /tmp/zone-evidence
python3 docs/pr-assets/agent-fab-router-native-drc-gate/verify.py /tmp/zone-evidence/native-run
```

No route search, benchmark input, checker or scoring was changed. This optional gate
remains outside the automatic benchmark/editor path. Nine unsafe routing outputs and
their 27 thermal errors remain unresolved. Rejection is not a routing score gain.

Final checks and paired report comparison are retained in checks.log and comparison.json.

 890 pass
 0 fail
 398556 expect() calls
Ran 890 tests across 34 files. [256.71s]
