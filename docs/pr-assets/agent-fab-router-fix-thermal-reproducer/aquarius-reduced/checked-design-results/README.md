# Bind diagnostic checks before acceptance

The native checker can save a different design after short-induced net reassignment.
Previously the generated diagnostics evaluated errors and terminal partitions without
binding the saved board to the proposed design until an independent post-run audit.
`transaction.checked_native` now rejects changed design nodes or native rule sidecars
before the acceptance predicate runs. It shares the existing design signature with
the retained-evidence verifier: top-level ordering, numeric formatting and zone fill
polygons may change; copper nets, pads, zone rules and other design metadata may not.

This is a diagnostic guard, not a production routing fix. Rejected native outputs
and reports remain on disk. The transaction records `ValueError` and returns the
exact previous board bytes. Baseline identity failures abort the diagnostic run.
The generated-evidence verifier independently establishes design/rule drift for
these recorded rejections, and rejects unexplained exceptions.

Replay uses the 243 real checks retained in `../remaining-composed-results` (three
repeats). `--reference` runs the previous unguarded callback and intentionally exits
with a failed regression assertion. Native subprocesses are replaced only with
those exact retained output files and rows; DRC results are not invented. The
separate rollback controls replay all nine real changed designs and six changed
sidecars, checking exact bytes and explicit exception reporting.

The fresh compact witness run uses the same source as `../generated-results`.
The fresh targeted C1.2 full-board run uses the same composed source, pad and proposal
schedule as the corresponding subset of `../remaining-composed-results`. A supplemental U1.53 run also retains 63 native checks, with unchanged four errors,
fifteen opens and no accepted proposals across three repeats. These runs
use the original native version 10.0.6 and rules. These are static diagnostics,
not frozen routing benchmark runs. There is no routing improvement or speed claim.

Measured results on the same machine and inputs (three repeats):

| Diagnostic | Before | After |
| --- | ---: | ---: |
| Drift rejected in 243 retained checks | 0/9 | 9/9 |
| Unchanged designs allowed | 234/234 | 234/234 |
| Compact: accepted repeats; errors before/selected; opens | 3/3; 1/0; 1 | 3/3; 1/0; 1 |
| C1.2: accepted repeats; errors before/selected; opens | 0/3; 4/4; 15 | 0/3; 4/4; 15 |
| C1.2: saved-design drift rejected before acceptance | 0/9 | 9/9 |

Before native results are retained prior runs; after native results are fresh
(21 compact + 63 C1.2 + 63 supplemental U1.53 checks). Neither full-board search
accepts a proposal. The frozen routing reference remains 39/78 passing runs,
13/26 valid cases, 120 opens and 27 new thermal errors; no new router run occurred.
No history row or pin bump is appropriate for these static diagnostics.

From repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
results=$asset/checked-design-results
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/checked-design-controls.py" --reference --out /tmp/design-before
# Expected exit 1 above: nine design drifts are not rejected.
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/checked-design-controls.py" --out /tmp/design-after
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/checked-boundary-controls.py" --out /tmp/design-boundary
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/generated-transaction.py" --source "$asset/repair-reduction-results/minimal.kicad_pcb" --out /tmp/design-native-compact
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 "$asset/verify-generated-transaction.py" "$results/compact-native" --source "$asset/repair-reduction-results/minimal.kicad_pcb"
mkdir -p /tmp/design-source
gzip -dc "$asset/remaining-composed-results/source.kicad_pcb.gz" > /tmp/design-source/source.kicad_pcb
cp "$asset/remaining-composed-results/source.kicad_pro" "$asset/remaining-composed-results/source.kicad_dru" /tmp/design-source/
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/generated-transaction.py" --all-targets --track-limit 2 --target-pad-uuid 0058b9c6-73af-4ba8-a061-fb00a457a84f --source /tmp/design-source/source.kicad_pcb --out /tmp/design-native-full
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/verify-generated-transaction.py" "$results/targeted-native" --source /tmp/design-source/source.kicad_pcb
/usr/bin/python3 "$asset/render-checked-design.py" "$results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```
