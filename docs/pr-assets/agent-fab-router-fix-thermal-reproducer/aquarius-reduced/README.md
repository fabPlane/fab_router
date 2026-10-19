# Rotated back-layer thermal failure reduced from the completed baseline

This static native reproducer preserves Aquarius U1.39 (315-degree rounded
rectangle, 75 micrometre corner radius) and its B.Cu zone. It has one pad,
three 0.2032 mm tracks, no vias, and one zone. Its sole native error is
`starved_thermal`: one spoke, minimum two. This is not a router fix or a new
routing benchmark. All 27 baseline thermal errors remain unresolved.

Fresh native refill plus DRC, same host and cores 20–25, three repeats per row:

| Fixture control | Before: all tracks | After: indicated deletion |
| --- | ---: | ---: |
| First track removed | 1 error, 0 opens each | 0 errors, 0 opens each |
| Second track removed | 1 error, 0 opens each | 0 errors, 0 opens each |
| Third track removed | 1 error, 0 opens each | 0 errors, 0 opens each |
| All tracks removed | 1 error, 0 opens each | 0 errors, 0 opens each |

The shared before column describes the same three runs, not twelve runs.
Fifteen native checks total. Deleting obstacles is a diagnostic control and
would discard intended routing; it is not an acceptable production remedy.
The three non-ground tracks have different nets. Their terminals have been
removed, so zero opens in this static fixture does not establish completion
of those nets. There is no routing attempt, engine regression, or native
transaction implementation here.

The reducer first retained objects whose native bounding boxes intersect a
2 mm square radius around the pad, then deleted pad/copper/zone UUID groups
while requiring the exact target and no other error. Single-object deletion
trials finish the search. This establishes irreducibility only among retained
candidate objects; the board outline, zone polygon, graphics and unused net
definitions have not been geometrically minimized. `reduction.json` retains
24 trials and their exact native findings.

`provenance.json` verifies that pad geometry, each retained track and the full
zone definition (excluding refill polygons) match the completed baseline
output. Both project and rule sidecars match the output and original input
byte-for-byte. The pad position is the baseline output position, with its
previously recorded +8/-46 nm displacement from the original input. That
small displacement is not attributed to the failure. `LICENSE` preserves
the source board license.

`board.dsn` is a native export for further engine diagnostics. It does not
encode native thermal metadata and is not claimed to reproduce native
starvation when routed independently. Keep the native board and sidecars.
`results/` retains all fifteen refilled boards, native JSON reports and hashes.
The comparison image uses actual B.Cu exports after refill.

From the engine repository root, using native version 10.0.6:

```bash
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify.py" --out /tmp/aquarius-native-controls
source_run="$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 "$asset/reduce.py" --source "$source_run" --out /tmp/aquarius-reduction
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 "$asset/provenance.py" --source "$source_run" --original "$HOME/bench/repos/fab_pcb/benchmarks/autorouter/cases/kitspace-aquarius-j4/board.kicad_pcb" --out /tmp/aquarius-provenance
kicad-cli pcb export svg --layers B.Cu --page-size-mode 2 --exclude-drawing-sheet --mode-single --output /tmp/aquarius-all.svg /tmp/aquarius-native-controls/all-1/board.kicad_pcb
kicad-cli pcb export svg --layers B.Cu --page-size-mode 2 --exclude-drawing-sheet --mode-single --output /tmp/aquarius-control.svg /tmp/aquarius-native-controls/without-track-1-1/board.kicad_pcb
python3 "$asset/render.py" /tmp/aquarius-all.svg /tmp/aquarius-control.svg /tmp/aquarius-comparison.svg
rsvg-convert /tmp/aquarius-comparison.svg -o /tmp/aquarius-comparison.png
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Production source and engine tests remain unchanged. No frozen cases, checker,
scoring or shared runtime were edited. No full sweep or history row is added
because these are static native checks without a router run.

## Local-axis corridor audit

`local-corridors.py` reads the fifteen retained native outputs without routing
or refilling. It verifies their board/report hashes against `results/summary.json`
and measures positive-area polygon subtraction on B.Cu. Rectangles start at
local pad edges, rotate with the 315-degree pad, and extend 0.508 mm. These are
candidate geometric corridors, not resolved native thermal spokes. Rounded
corners and a strip wider than the pad make the stored-width test especially
unsuitable as a universal criterion.

All three repeats have identical areas for each configuration:

| Static native control | Native errors before → after | Fully covered 0.100 mm local corridors | Fully covered 0.508 mm local corridors |
| --- | --- | --- | --- |
| All tracks retained | 1 → 1 | −x | none |
| Track 1 removed | 1 → 0 | −x, −y | none |
| Track 2 removed | 1 → 0 | +x, −x | none |
| Track 3 removed | 1 → 0 | −x, +y | none |
| All tracks removed | 1 → 0 | +x, −x, +y, −y | none |

Before refers to the same previously measured all-track configuration;
this audit adds no native runs. The native checker accepts every deletion
control even though no full stored-width rectangle is covered. This rejects
that rectangle criterion as a general safety test. The narrow rectangles
explain which direction each obstacle blocks in this fixture, but their
agreement with the native findings is not a general spoke-count algorithm,
effective-rule resolution, connectivity proof, or routing remedy.

For every board, direction and width, controls require full self-coverage,
no empty-copper coverage, and partial coverage with a half-length strip.
A long-axis point hits the actual native pad under the chosen rotation;
the opposite rotation convention fails that control. Two independent audit
invocations produce byte-identical JSON. `local-results/` contains the
measurements and chart; the existing `results/` retains the source boards
and reports. Native imports emit existing library diagnostic messages, kept
in the raw log. Engine source/tests remain unchanged.

```bash
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 "$asset/local-corridors.py" --out /tmp/aquarius-local-corridors
rsvg-convert /tmp/aquarius-local-corridors/comparison.svg -o /tmp/aquarius-local-corridors/comparison.png
```

## Complete-track translation diagnostic

Added a native translation sweep on the reduced rotated B.Cu fixture. Each trial retains the rounded pad, zone, project/rules and all three tracks, changing only both endpoints of one track by the same outward displacement. This compares relocation against the earlier deletion controls; it is not routing or connectivity preservation.

Same static fixture, machine, native version 10.0.6 and cores 20–25; three fresh refill/DRC checks per configuration. Entries are native errors in every repeat:

| Selected outward translation | Before: 0 µm | 25 µm | 50 µm | 100 µm | 200 µm | 400 µm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Track 1, local −y | 1 | 1 | 1 | 1 | 1 | 1 |
| Track 2, local +x | 1 | 1 | 1 | 0 | 0 | 0 |
| Track 3, local +y | 1 | 1 | 1 | 0 | 0 | 0 |

The baseline column shares three checks across rows; 48 checks total. All retain one pad, three tracks, no vias and one zone. The 0.100 mm filled corridors recover +x for track 2 and +y for track 3 at every native-clean displacement. These rectangles are diagnostics, not a general spoke-count rule. The sweep brackets a change between 50 and 100 µm for tracks 2 and 3; it does not identify a minimum safe clearance. Moving track 1 by up to 400 µm is insufficient. Track endpoint changes would disconnect original routing, and the reduced fixture lacks those other-net terminals. Zero reported opens therefore does not establish completion. No general guard, production fix, frozen benchmark improvement or pin bump is claimed. The full baseline remains 39/78 passes, 13/26 cases passing 3/3, 120 opens and 27 unresolved native thermal errors.

Reproduce from the repository root, with a fresh output directory:

```bash
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/translate-tracks.py" --out /tmp/aquarius-translations
rsvg-convert /tmp/aquarius-translations/comparison.svg -o /tmp/aquarius-translations/comparison.png
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

`translation-results/` retains all 48 boards/reports, exact input/output hashes, displacement vectors, local filled-corridor measurements and raw logs. Repeated native findings and corridor measurements are asserted identical. Engine source/tests are unchanged.

![Measured native errors under complete-track translation](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/translation-results/comparison.png?raw=true)

### Sequential full-board proposal replay

`compose-generated.py` applies the previously accepted R20 and U1.39 proposals
in sequence, validating each against the latest accepted native error report and
terminal partition. Rejection or checker failure preserves the latest accepted
bytes and baseline. Controls reject a deliberately stale-baseline mutation.
This is a static diagnostic using published witnesses, not a production repair.

| Full board, same machine, three repeats | Original | After R20 | After U1.39 |
| --- | ---: | ---: | ---: |
| Native errors per repeat | 6 | 5 | 4 |
| Opens per repeat | 15 | 15 | 15 |
| Terminals preserved | 234 | 234 | 234 |
| Terminal groups | 74 | 74 | 74 |

All three selected byte hashes agree. A fresh native refill of each selected
board reproduces its four errors and terminal partition. Each accepted error
multiset is a strict subset of its immediate predecessor; no connected terminal
pair is lost. Four thermal errors and fifteen opens remain unresolved. The
frozen router benchmark score has not changed or been rerun for this diagnostic.

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/compose-generated.py" --controls
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 "$asset/compose-generated.py" --out /tmp/composed-native
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 "$asset/verify-composed.py" --results "$asset/composed-generated-results"
/usr/bin/python3 "$asset/render-composed.py" /tmp/composed-native
```

`composed-generated-results/` retains compressed boards/native reports, exact
sidecars, byte hashes, terminal groups, controls, logs and the comparison image.
The independent verifier regenerates candidate geometry from published witness
metadata and checks all twelve reports and native terminal partitions.

### Bind retained native boards to each sequential proposal

The sequential verifier previously regenerated the proposed bytes and checked
native terminal partitions separately. A substituted checked board could keep
the same terminal partition and pass despite having different design geometry.
The verifier now compares every checked board's complete design tree against its
corresponding original, candidate or final replay input. It permits top-level
item ordering, numeric formatting and zone `filled_polygon` output changes.
Zone definitions, thermal settings, footprints, pads, copper and board setup
remain part of the comparison. Both native rule sidecars must match the source.

Five controls use the same retained three-repeat dataset on the same machine,
one verifier invocation per control before and after. Artifact manifest hashes
are rebound after substitution, so these exercise semantic checks rather than
only digest checks. The before revision is `8ee4122`.

| Diagnostic verifier control | Before | After |
| --- | --- | --- |
| Original twelve native board/report pairs | Accept | Accept |
| Substitute final candidate for baseline board | Accept (bug) | Reject |
| Substitute baseline for first candidate board | Accept (bug) | Reject |
| Substitute baseline for final replay board | Accept (bug) | Reject |
| Replace candidate native rule file | Accept (bug) | Reject |

The accepted full-board diagnostic still has 6 → 5 → 4 errors and fifteen opens
in each of three repeats. This checks retained evidence; it does not rerun native
DRC or authenticate externally supplied reports. The production failure remains
unfixed. No routing benchmark was rerun and no score or speed gain is claimed.
The completed shared baseline was inspected read-only: it confirms 39/78 passes,
13/26 valid cases, 120 opens and 27 new `starved_thermal` errors.

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/composed-binding-controls.py" --out /tmp/composed-binding-controls
/usr/bin/python3 "$asset/render-binding.py" "$asset/binding-results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

`binding-results/` retains before/after control summaries, raw logs, validation
output and the measured chart. These are static verifier controls, not router
benchmark runs.

![Native artifact substitution controls](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/binding-results/comparison.png?raw=true)

### Remaining composed-board thermal failures

The latest experiment starts from the previously composed full board (six native errors reduced to four), and searches the two nearest foreign straight tracks around each remaining thermal pad. Each track receives ten signed normal translations with endpoint links. Candidates are accepted only if native errors strictly decrease, the positive-net terminal inventory remains exact, no connected terminal pair is lost, and opens do not increase. Every rejection returns the exact starting board bytes.

Same board, rule sidecars, machine `hyper-ms-lin`, cores 20–25, native version 10.0.6; three repeats:

| Remaining pad | Proposals per repeat | Target remains | Accepted repeats | Errors before / selected | Opens before / selected |
| --- | ---: | ---: | ---: | ---: | ---: |
| C1.2 | 20 | 20/20 | 0/3 | 4 / 4 | 15 / 15 |
| U1.53 | 20 | 13/20 | 0/3 | 4 / 4 | 15 / 15 |
| U1.46 | 20 | 20/20 | 0/3 | 4 / 4 | 15 / 15 |
| U1.48 | 20 | 20/20 | 0/3 | 4 / 4 | 15 / 15 |

U1.53 loses its thermal error in seven proposals per repeat, but six introduce shorts and one clearance errors; all seven also add solder-mask bridge errors. Two U1.46 proposals and one U1.48 proposal lose connected terminal pairs. All 243 native checks are retained.

These are static native diagnostics, not router benchmark runs. The full frozen reference remains **39/78 passing runs, 13/26 valid cases, 120 opens and 27 new thermal errors**. No routing score or speed gain is claimed. No engine, adapter, frozen input, checker or scoring code changed.

Independent replay verifies native reports, rebuilt terminal partitions, target coverage, proposal ranking/geometry, selected bytes and manifests. The new audit compares every checked design and both native rule sidecars to its proposed input. Nine rejected boards (three proposals, repeated three times) show native net reassignment after save; exact differences are retained. Baselines match their proposed designs. No candidate is accepted. Identical compressed artifacts use relative symlinks within the evidence directory. Its rejection table distinguishes target removal from added clearance errors, shorts and connectivity loss.

Required checks: typecheck PASS; layer checks 65 files / zero violations; 859 tests / zero failures / 398454 assertions.

Reproduce from repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
results=$asset/remaining-composed-results
mkdir -p /tmp/remaining-source
gzip -dc "$results/source.kicad_pcb.gz" > /tmp/remaining-source/source.kicad_pcb
cp "$results/source.kicad_pro" "$results/source.kicad_dru" /tmp/remaining-source/
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 "$asset/generated-transaction.py" --all-targets --track-limit 2 --source /tmp/remaining-source/source.kicad_pcb --out /tmp/remaining-native
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/audit-remaining.py" --results /tmp/remaining-native --source /tmp/remaining-source/source.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/audit-remaining.py" --results "$results" --source /tmp/remaining-source/source.kicad_pcb
/usr/bin/python3 "$asset/render-remaining.py" "$results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Remaining thermal proposal rejection counts](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/remaining-composed-results/comparison.png?raw=true)

Earlier minimized boards, composed native repair evidence, exact reproduction commands and images remain in the [diagnostic README](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/README.md). Native transaction ownership and production integration remain open work.
