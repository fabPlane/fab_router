# Ground-pour corridor partial recovery

This is a diagnostic and regression fixture, with no engine/search behavior change.
The complete 74-item, two-net Aquarius witness disconnects U1.53 from 61 source
peers. Move two generated TCK vias 0.1 mm left and down, updating all three
attached track endpoints. All other generated copper and all source geometry,
rules, net ownership, widths and drills remain exact.

Same host, cores 20–25, native 10.0.6 checker, three fresh paired checks per row:

| Control | New thermal errors | Opens | Lost source pairs | Lost routed pairs | Copper preserved | Accepted |
|---|---:|---:|---:|---:|---|---:|
| Original two complete nets | 2 | 94 | 61 | 0 | yes | 0/3 |
| Moved via pair | 2 | 93 | 0 | 0 | yes | 0/3 |

The ground B.Cu fill rejoins two outlines into one. An additional single-via
control localizes the cut: moving only the upper via (162.9939,50.8553) left/down
by 0.1 mm also restores all source/routed pairs; moving only the lower via does
not. The upper control has not received the three-repeat strict ownership gate
validation of the paired fixture. Its original floating-point input bytes are
retained, as are all other discovery candidates.

The nominal clearance envelope between the upper TCK via and the nearby +3V3
via grows from 0.1233869 to 0.2454367 mm, crossing the unchanged 0.2032 mm zone
minimum thickness. This circle-only estimate helps locate the neck; the actual
native fill and terminal partitions establish the connectivity result.

The first two discovery scripts shared a summary filename; the replay rebuilds
all32rows from their individually retained reports and partitions, including
those earlier summary rows. No board/report/attempt was overwritten.
All 32 discovery/refill checks are retained: source controls, six rejected ground
stitches, local lower/upper track detours, corridor detours, single-lower-via moves,
paired moves and single-upper-via moves. Report-clean connectivity does not
excuse introduced clearance/short errors. Discovery scripts used binary float
coordinates; the initial paired strict-gate candidates were rejected because
51.658500000000004 becomes 51.6585 on native save. The initial failing regression
and six strict decisions remain. The final fixture uses exactly 51.6585, with no
comparison tolerance or safety-rule change. Six fresh normalized strict decisions
are recorded separately. No native attempted candidate is omitted.

Independent Decimal inventory replay also verifies the normalized candidate
against its separately native-saved copper and the source-copper subset.

The new empirical regression verifies all five changed generated items exactly,
source and routed connectivity, native copper ownership and continued rejection
of both remaining thermals. It is not a production fail-first bug fix. The
existing search still refuses the source-disconnecting original and cannot move
vias. No automatic recovery or full Aquarius repair is claimed.

The retained full 466-item Aquarius output was also checked before/after using
the exact same five-item move (three fresh paired native decisions per version):

| Full-board control | New errors | Opens | Lost source pairs | Lost routed pairs | Copper preserved | Accepted |
|---|---:|---:|---:|---:|---|---:|
| Full generated output | 6 thermals | 15 | 348 | 0 | yes | 0/3 |
| Full output with moved via pair | 6 thermals + 3 clearances | 14 | 292 | 0 | yes | 0/3 |

The full context reconnects 56 source pairs but introduces THREE clearance
errors against other generated copper. It is a rejected experiment, not a
measured routing improvement. Both the final and routed-relative gates reject.
The reduced witness does not expose these full-context neighbors.
A final targeted full-board control moves only the upper TCK via upward0.4mm
(two fresh decisions, original and candidate). It preserves ownership and routed
pairs with no extra clearance errors, but remains6thermals15opens348lost
source pairs: no recovery. These attempts are also retained.
No router was rerun, no automatic search change was made, and this cannot be
counted as a scored pass. `reproduce-full.ts` reconstructs these exact controls.

Last full optional suite is c211 (not rerun): both versions 45/78 passes,
15/26 valid cases,120 opens,18 thermal errors. Last default suite:39/78 passes,
13/26 valid cases,120 opens,27 thermal errors. The unmodified full Aquarius remains6thermal
errors15opens348lost source pairs per seed. No scored routing gain is claimed.

Required final checks passed: typecheck;65layer files,zero violations;
927tests,zero failures,398892assertions in937.22seconds. The final regression
passed in the complete suite.

From engine checkout:
```sh
asset=docs/pr-assets/agent-fab-router-native-drc-gate/c213-via-corridor
mkdir -p /tmp/c213-evidence
tar -xJf "$asset/evidence.tar.xz" -C /tmp/c213-evidence
python3 "$asset/verify.py" /tmp/c213-evidence
python3 /tmp/c213-evidence/topology.py /tmp/c213-evidence
python3 /tmp/c213-evidence/verify-copper.py /tmp/c213-evidence
# Fresh paired native checks against the committed fixture:
taskset -c 20-25 nice -n 10 timeout 600 bun "$asset/reproduce-recheck.ts" /tmp/c213-fresh
# Optional full-board retained-output check, three repeats each:
taskset -c 20-25 nice -n 10 timeout 600 bun "$asset/reproduce-full.ts" /tmp/c213-full-fresh
# Focused regression and required suite:
taskset -c 20-25 nice -n 10 timeout 300 bun test test/native-aquarius-connectivity.test.ts --test-name-pattern 'moving a generated via pair'
taskset -c 20-25 nice -n 10 timeout 2400 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Next: use the isolated upper-via corridor to design a bounded source/current-safe
native candidate family, with strict ownership/fidelity/open budgets unchanged.
Restoring the corridor does not address the independent U1.53/U1.55 thermals.
Do not weaken initial source connectivity or publish this partial recovery.
