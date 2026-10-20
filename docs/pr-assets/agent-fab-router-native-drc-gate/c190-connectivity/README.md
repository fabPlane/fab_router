# Connectivity report validation

A malformed inherited connectivity entry previously counted as an open: `[null]`
allowed a candidate with one real open to pass the count comparison. Both reports now
require typed error-level missing-connection findings with two or more described,
finite-coordinate endpoints before counting opens. This is report-boundary hardening,
not thermal repair or design-fidelity validation.

The retained failing-before log exercises the existing comparator, not a missing module.
The same regression passes after the fix for seven corruptions on either side (14 checks).
The remaining focused controls retain thermal/multiset/policy/rules coverage.

Fresh native checks use the exact same 26 retained boards × 3 seeds as cycle 189,
on the same machine and cores 20–25, native checker 10.0.6. Routing is not rerun.

```bash
bun test test/native-drc-gate.test.ts
bun run typecheck && bun run check:layers && bun run test
python3 docs/pr-assets/agent-fab-router-native-drc-gate/measure.py \
  --prior /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c188/final-run \
  --source "$PWD" --out /tmp/native-gate-connectivity
python3 docs/pr-assets/agent-fab-router-native-drc-gate/verify.py /tmp/native-gate-connectivity
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c190-connectivity/verify.py \
  /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c189/native-run \
  /tmp/native-gate-connectivity
```

`native-evidence.tar.xz` contains all fresh reports and result records. The parent
asset directory retains the prior native control archive. Extract each archive to a
separate directory and give the directories to `verify.py` to replay the comparison.
Native timestamps and open endpoint witnesses may differ: 11 candidate reports selected
different witnesses. Full reports are retained; policy/error findings, open counts and
source hashes match. This gate compares open counts, not terminal partitions.

Results: 69/78 accepts and 9/78 rejects before and after; all 27 thermal errors
detected; 120 underlying opens; routing remains 39/78 passes and 13/26 cases passing
3/3. Required checks: typecheck/layers and 870 tests pass. Synthetic malformed controls
block 0/14 before versus 14/14 after, each of three repeats.

Setup-only chart attempt lacked matplotlib; no measurement ran in that failed attempt.
The committed chart uses SVG plus rsvg-convert. An initial overstrict comparison asserted
full report equality and exposed the native witness differences above; the retained final
comparator explicitly records them and checks unchanged policy/errors/counts instead.

Malformed controls reproduce against an extracted pre-fix tool module and the current tool:

```bash
git show 5a1d2229:tools/native-drc-gate.ts > /tmp/native-gate-before.ts
bun docs/pr-assets/agent-fab-router-native-drc-gate/c190-connectivity/malformed-controls.ts /tmp/native-gate-before.ts
bun docs/pr-assets/agent-fab-router-native-drc-gate/c190-connectivity/malformed-controls.ts "$PWD/tools/native-drc-gate.ts"
```
