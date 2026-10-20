# U1.55 ground reconnection exposes another thermal failure

This is a rejected full-context diagnostic of the retained Aquarius J4 output,
not an engine change or a newly scored routing improvement. Source geometry,
pads, zones, rules, copper ownership, widths and drills remain protected.

The starting point retains all 466 generated items and applies the earlier
coordinated TCK/LED4 corridor move. Moving the generated capacitor via
(165.815,48.1278) to (165.815,48.0278), together with its two incident tracks,
restores 57 source pairs involving U1.55. All current routed pairs survive.
Native refill exposes a seventh starved thermal at U1.55 (one spoke; two
required). No added clearance error occurs, but both final and relative repair
acceptance reject the candidate. This does not repair the scored case.

Same retained input, host and native checker; cores 20–25; three fresh paired
strict decisions per version (not three routing seeds):

| Measure per decision | Before | Capacitor via up 0.10 mm |
|---|---:|---:|
| New thermal errors | 6 | 7 |
| New clearance errors | 0 | 0 |
| Opens | 14 | 13 |
| Lost source terminal pairs | 292 | 235 |
| Lost current terminal pairs | 0 | 0 |
| Native copper geometry/ownership | preserved | preserved |
| Relative repair acceptance | 3/3 | 0/3 |
| Final acceptance | 0/3 | 0/3 |

All 23 discovery/refill attempts are retained, including failures: starting
control; four downward power-track moves; four capacitor-track detours; four
U1.55-only ground stitches; four capacitor-via moves; three outer-power-elbow
moves; and three combined via/power-elbow moves. Several exploratory candidates
short nets. Their reported connectivity is
not a legal repair. All 23 exact submitted/native copper inventories match;
no net reassignment was observed in this diagnostic group.
`verification.json` records exact submitted/native inventory equality for each
attempt rather than assuming report counts establish ownership. No scored routing or standalone repair-search benchmark was rerun. The last full optional pipeline remains 45/78 passes,
15/26 cases valid, 120 opens and 18 new thermal errors; the default remains
39/78, 13/26, 120 and 27. These are prior measurements, not fresh measurements.

The new native regression checks exact three-item translation, all native
ownership checks, source/current pair counts, opens, all seven thermals,
continued rejection and the newly exposed U1.55 marker. It adds diagnostic
coverage for existing behavior, not a fail-first production fix.

From the repository root, extract and independently replay the retained data:

```sh
asset=docs/pr-assets/agent-fab-router-native-drc-gate/c215-pad55-thermal
mkdir -p /tmp/c215-evidence
tar -xJf "$asset/evidence.tar.xz" -C /tmp/c215-evidence
python3 /tmp/c215-evidence/verify.py /tmp/c215-evidence
```

Repeat fresh paired checks or the complete discovery sequence into new paths:

```sh
taskset -c 20-25 nice -n 10 timeout 600 bun /tmp/c215-evidence/recheck.ts /tmp/c215-strict-new
for script in probe probe-detour probe-stitch probe-via probe-joint55 probe-outer-elbow; do
  taskset -c 20-25 nice -n 10 timeout 700 python3 "/tmp/c215-evidence/$script.py" /tmp/c215-probes-new
done
taskset -c 20-25 nice -n 10 timeout 240 bun test test/native-aquarius-connectivity.test.ts --test-name-pattern 'reconnecting U1.55'
taskset -c 20-25 nice -n 10 timeout 3000 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Probe scripts select the repository from the working directory; the optional
argument selects a new output directory. Their path selectors were made portable
after measurement; the geometry families are unchanged. Full source hashes,
raw reports, native-saved boards, partitions, strict decisions, rules, fixture
license, native-tool snapshot and test logs accompany the evidence. Native diagnostic
messages are retained. Rendering uses `render.py` and exported B.Cu SVGs.

The first required full run passed all 929 real tests, but Bun also discovered
the previous cycle's documentation evidence copy named `regression.test.ts`.
Its archived relative imports failed outside the test directory. Rename that
public evidence copy to `regression.ts` (identical bytes), update its manifest,
and use the same non-test filename for this cycle's public evidence. Compressed
archives retain original names and bytes. No real test or assertion is removed.
The first complete failure log is retained; a fresh full required run verifies
the filename fix. This fixes test collection, not router behavior.

Final required checks passed: typecheck; 65 files / zero layer violations;
929 tests, zero failures, 398,923 assertions in 938.03 seconds. The final
focused regression passes with all 16 assertions.
