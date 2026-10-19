# Routed-connection preservation for proposed repairs

The source-only acceptance boundary cannot prove that a repair preserves connections
added by routing. A four-pad example routes three pads, then replaces one generated
segment to connect a different third pad. Native errors stay zero and opens stay one.
Two routed terminal pairs are lost. Source-only publication accepts the proposal; the
new three-board repair boundary rejects it.

This is an offline safety feature for supplied repair proposals. No bounded-search,
engine, adapter, live-editor or scoring change is included. The existing complete-board
thermal repair witness is reused unchanged; no new repair geometry is claimed.

The archive retains the matched 26-case × three-seed corpus checks, three rewiring
controls, three existing complete-board thermal repair controls, original boards/rules,
full native reports, terminal partitions and exact published snapshots. `before` uses
80f1fb7f's source-only publication command. `after` adds the routed baseline and checks
its connected pairs, opens and error signatures independently of the source boundary.
The corpus uses unchanged routed boards as repair proposals to test compatibility.
These are native rechecks of cycle196 router outputs, not fresh scored routing runs.
The last actual full routing summary remains 39/78 passed, 13/26 cases valid 3/3,
120 opens and 27 new thermal errors. Those routing failures remain unresolved.

Reproduce one corpus pair and both controls from the repository root:

```bash
mkdir /tmp/native-repair-evidence
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c200-repair-handoff/native-evidence.tar.xz -C /tmp/native-repair-evidence
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c200-repair-handoff/verify.py /tmp/native-repair-evidence
bun /tmp/native-repair-evidence/before-tool/native-candidate-bundle.ts /tmp/native-repair-evidence/controls/rewired-0/input/board.kicad_pcb /tmp/native-repair-evidence/controls/rewired-0/repaired/board.kicad_pcb /tmp/before-rewired.json
# Expected exit 1; no bundle created:
bun tools/native-repair-bundle.ts /tmp/native-repair-evidence/controls/rewired-0/input/board.kicad_pcb /tmp/native-repair-evidence/controls/rewired-0/routed/board.kicad_pcb /tmp/native-repair-evidence/controls/rewired-0/repaired/board.kicad_pcb /tmp/after-rewired.json
bun tools/native-repair-bundle.ts /tmp/native-repair-evidence/controls/thermal-0/input/board.kicad_pcb /tmp/native-repair-evidence/controls/thermal-0/routed/board.kicad_pcb /tmp/native-repair-evidence/controls/thermal-0/repaired/board.kicad_pcb /tmp/after-thermal.json
bun tools/native-repair-bundle.ts /tmp/native-repair-evidence/native/000/input/board.kicad_pcb /tmp/native-repair-evidence/native/000/candidate/board.kicad_pcb /tmp/native-repair-evidence/native/000/candidate/board.kicad_pcb /tmp/after-corpus.json

taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Use absent destination paths. Requires native CLI and matching Python bindings (10.0.6
for the recorded checks). Each process has a timeout. `measure.py` and `controls.py`
retain exact original generation commands and local provenance paths; the extracted
boards above provide portable inputs without relying on those local paths.

The original failing regression used `checkNativeBoards(source, repaired)` and expected
rejection. It failed because acceptance was true. The final regression explicitly
retains that control and uses `checkNativeRepair(source, routed, repaired)` for rejection.
Snapshots in repair bundles contain the original bytes, not native-refilled saves.
The verifier independently enumerates connected terminal pairs and checks all bundle
hashes and bytes. It does not rerun DRC or certify unrelated board metadata.
