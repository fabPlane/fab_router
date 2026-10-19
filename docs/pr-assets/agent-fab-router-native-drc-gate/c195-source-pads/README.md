# Preserve source terminals before native candidate validation

The optional native gate accepted a board after an unconnected source pad was deleted:
both native reports contained zero errors and zero opens. The native-runner regression
fails first against 7b6b2245 because the promise resolves. The fix compares the multiset
of footprint pads, their geometry, ownership, custom primitives and local rules, plus
footprint placement/rotation/side and clearance/mask/paste/thermal overrides. It permits
regenerated pad UUIDs, numeric formatting and named-field order. Other footprint metadata,
external libraries and live-editor transactions remain outside this check.

Same machine hyper-ms-lin, cores 20–25, native checker 10.0.6; three repeats:

| Measurement | Before | After |
|---|---:|---:|
| Deleted-pad control blocked | 0/3 | 3/3 |
| Retained candidate pairs eligible | 69/78 | 60/78 |
| Source-pad preflight rejections | 0/78 | 12/78 |
| Native-error rejections after preflight | 9/78 | 6/78 |
| Underlying routing passes / cases passing 3/3 | 39/78 / 13/26 | unchanged; router not rerun |
| Underlying opens / new thermal errors | 120 / 27 | unchanged; router not rerun |

All 26 retained cases × three seeds are included. Twelve outputs in four cases change
footprint coordinates: the three supply-board variants and the six-thermal-error case.
For example, 70.405952 mm becomes 70.406 mm. The strict gate blocks these changes rather
than assuming a tolerance. Nine of those candidates were previously eligible; the other
three already failed native thermal checks. This additional rejection is deliberate,
but requires an integration fix before these outputs can be accepted. Exact signature
differences and source hashes are retained in pad-differences.json. No pad normalization
was added to hide this integration defect.

The remaining 66 candidate pairs receive 132 fresh native checks; their decisions and
error/open counts match the previous cycle. The six surviving native rejections contain
nine added thermal errors. The 18 added thermal errors in the three preflight-rejected
outputs are inherited benchmark evidence, not freshly evaluated native findings here.
This is neither a route repair nor a routing score gain. No router, frozen input, checker,
scoring rule or route-search function was changed.

Reproduce from repository root (output directories must not already exist):

```bash
mkdir -p /tmp/pad-control
git show 7b6b2245:tools/native-drc-gate.ts > /tmp/pad-control/native-drc-gate.ts
git show 7b6b2245:tools/kicad-board-rules.ts > /tmp/pad-control/kicad-board-rules.ts
bun docs/pr-assets/agent-fab-router-native-drc-gate/c195-source-pads/controls.ts /tmp/pad-control/native-drc-gate.ts /tmp/pad-before
bun docs/pr-assets/agent-fab-router-native-drc-gate/c195-source-pads/controls.ts tools/native-drc-gate.ts /tmp/pad-after
bun test test/native-source-pads.test.ts test/native-drc-gate.test.ts
bun run typecheck && bun run check:layers && bun run test
mkdir /tmp/pad-audit
bun docs/pr-assets/agent-fab-router-native-drc-gate/c195-source-pads/audit.ts /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c194/native-run /tmp/pad-audit
bun docs/pr-assets/agent-fab-router-native-drc-gate/c195-source-pads/measure.ts /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c194/native-run /tmp/pad-audit/native-run
```

The complete retained source suite is on the benchmark host. Independently replay the
public captured evidence without native execution or those private paths:

```bash
mkdir /tmp/pad-evidence
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c195-source-pads/native-evidence.tar.xz -C /tmp/pad-evidence
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c195-source-pads/verify.py /tmp/pad-evidence
```

Native report filenames in native-run are the zero-based row index; the older report
field in each row identifies prior-cycle provenance. Native reports retain warnings.
The initial strict pad preflight failure is retained in preflight.log and led to the
explicit footprint-coordinate audit; it was not a failed or omitted native run.

Validation: typecheck and layer checks pass; 894 tests pass, zero fail (260.97 s).
The measurement session returned 143 after writing all 78 rows and its summary.
All 66 pair reports (132 native checks) exist; independent original and extracted
archive replay passes. Both measurement PIDs were absent afterward. Full status is
retained in process-status.json; no candidate pair or attempt was omitted.
