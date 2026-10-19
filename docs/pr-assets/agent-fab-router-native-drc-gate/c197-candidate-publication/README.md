# Publish the exact native-checked candidate

The optional gate now has a companion publication command. It retains the actual
in-memory board and rule snapshots passed to native validation, then writes one
self-contained JSON artifact only after acceptance. A complete staged artifact
becomes visible through an exclusive hard link. Existing destinations and symlinks
are never replaced. This avoids handing a downstream consumer a mutable path that
may no longer contain the checked board. Input paths and rule sidecars are protected,
including absent custom rules reached through directory aliases.

Six publication tests pass. The initial missing-command run had four failures and
one error-path pass; these were new feature tests, not engine regressions. A subsequent
concrete overlap regression failed because publication created an absent source rule
sidecar; the fixed version blocks it and directory aliases. A simulated checker changes
the caller's candidate board/project/custom-rule paths during validation: the bundle
still contains exactly the earlier checked snapshots. Other tests cover native rejection,
checker failure, destination collisions and dangling symlinks. Simulated checker tests
prove publication behavior, not native DRC geometry.

Same host `hyper-ms-lin`, cores 20–25, native checker 10.0.6, identical retained
26 cases × three seeds in both arms:

| Measurement | Read-only gate before | Publisher after |
|---|---:|---:|
| Eligible candidates | 69/78 | 69/78 |
| Added-native-error candidates blocked | 9/78 | 9/78 |
| Self-contained checked candidate artifacts produced | 0 | 69 |
| Underlying new thermal errors / opens | 27 / 120 | 27 / 120 |
| Underlying router passes / cases passing 3/3 | 39/78 / 13/26 | unchanged |

The routing outputs come from the earlier placement-preservation run at implementation
8fa7ead0. Both comparison arms receive these same corrected outputs. All 78 pairs pass
strict source-pad preflight; the earlier 12 coordinate-drift rejections have a separate
producer fix. This publication change does not receive credit for that fix. All paired
native decisions, new error multisets, open counts, rule policies and source hashes match.
The comparison performs 312 fresh native checks; the router is not rerun. Native report
timestamps and connectivity endpoint witnesses may differ and remain in the raw reports.
An initial one-pair comparison stopped on differing timestamps; its four native checks
and full evidence are retained separately rather than omitted.

A second control uses the existing complete two-error route and its previously generated
offline repair. Same source design and rules, three repeats: unsafe outputs are blocked
3/3 with two thermal errors and zero opens; repaired outputs are published 3/3 with zero
errors and zero opens. Twelve fresh native checks cover these six publication decisions.
This cycle changes none of that repair geometry and does not rerun its search. Every
published input/candidate board and rule file decodes byte-for-byte to its checked snapshot.
The documented extraction command was also exercised on a real repaired bundle.

Required typecheck and layer checks pass; 900 tests pass, zero fail, 398610 assertions,
241.37 seconds. Measured executable source hashes match implementation commit dee139f8.
The shared/frozen benchmark, scoring, checker, routing functions and editor remain unchanged.
No automatic repair, routing score gain, connected-terminal-pair proof, complete design
fidelity, live-editor atomic transaction, signed attestation or power-loss durability is
claimed. The host still needs its own exact-input binding and atomic application/undo.

## Reproduce

From the repository root, with fresh output directories:

```bash
bun run typecheck && bun run check:layers && bun run test
A=docs/pr-assets/agent-fab-router-native-drc-gate/c197-candidate-publication
mkdir /tmp/native-publication-evidence
tar -xJf "$A/native-evidence.tar.xz" -C /tmp/native-publication-evidence
python3 -B "$A/verify.py" /tmp/native-publication-evidence
python3 -B "$A/render.py" /tmp/native-publication-evidence /tmp/native-publication-chart
mkdir /tmp/native-publication-before
git show db315c4b:tools/native-drc-gate.ts > /tmp/native-publication-before/native-drc-gate.ts
git show db315c4b:tools/kicad-board-rules.ts > /tmp/native-publication-before/kicad-board-rules.ts
taskset -c 20-25 nice -n 10 timeout 2400 python3 -B "$A/recheck.py" \
  /tmp/native-publication-evidence /tmp/native-publication-fresh \
  --source "$PWD" --before-tool /tmp/native-publication-before/native-drc-gate.ts
```

The archive includes all checked boards, rules, full reports, bundle artifacts and source
licenses. `verify.py` independently reconstructs error multisets, decisions, hashes and
decoded file equality without native execution. `recheck.py` repeats 324 native checks
on the captured full suite and repair controls; the timestamp-only stopped pilot is
replayed by the verifier. `measure.py` records the original host measurement against the
retained full-suite results. `repairs.py` records original witness provenance under the
host scratch directory; use `recheck.py` for a portable native rerun of those same boards.

![Publication comparison](https://github.com/fabPlane/fab_router/blob/agent/fab-router-native-drc-gate/docs/pr-assets/agent-fab-router-native-drc-gate/c197-candidate-publication/comparison.png?raw=true)
