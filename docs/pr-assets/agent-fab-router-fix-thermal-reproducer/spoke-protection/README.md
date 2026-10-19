# Native-context spoke protection experiment

The unchanged router completes the miniature's intended T0–T1 connection but
cuts off a thermal spoke. This experiment supplies a net-aware fence around
the downward spoke, using native metadata that DSN does not carry. It changes
the routed copper and preserves that spoke after native import/refill.

This is a fixture-specific prototype. The downward direction is chosen
manually; there is no general spoke discovery or selection. It does not
implement production extraction, arbitrary pad shapes/rotations/overrides,
live adapter transactions, or a native safety guarantee. The guard is not
exported to the native board. Native settings and rules remain unchanged.

| Same miniature, host and cores 20–25; 3 repeats each | Baseline | Protected spoke |
| --- | ---: | ---: |
| Native errors before routing, each | 0 | 0 |
| Native thermal errors after import/refill, each | 1 | 0 |
| Native opens before → after, each | 2 → 1 | 2 → 1 |
| Engine incompletes before → after, each | 1 → 0 | 1 → 0 |
| Engine violations before/after, each | 0/0 | 0/0 |
| Added tracks / vias, each | 3 / 2 | 3 / 2 |

The remaining native open belongs to the retained obstacle net, not T0–T1.
Every native report is retained, including warnings and opens. No complete
board pass, frozen benchmark gain, or performance gain is claimed.

`audit.py` reads the native ground pad's bounding box and the zone's thermal
gap (0.508 mm), bridge width (0.508 mm), minimum thickness (0.254 mm), and
clearance (0.254 mm). Pad overrides are absent in this fixture and asserted.
`route.ts` constructs a bridge-width rectangle from the pad's bottom through
the gap and one minimum-thickness strip into the plane. It inflates the
rectangle by the difference between native and engine default clearances
(0.054 mm). The resulting native-coordinate box is
`[79.956, 131.518]–[80.572, 132.388] mm`. The guard exempts its own ground net.
This heuristic is tested only on this one manually selected spoke. In
particular, a fixed exterior strip is not a general proof of zone connectivity.

The paired runs use identical DSN beyond the exporter filename, seed 1,
default settings and unchanged engine bytes. Both start without engine
violations, including against the extra guard. Each resulting SES is imported
and refilled by native version 10.0.6 in a fresh process. The importer asserts
that every retained copper record survives. The audit additionally compares
native setup, footprints, outline and all zone fields other than refill
polygons before/after. Native reports assert the exact error counts and
classify the retained-net open. Engine source hashes are checked again after
all six runs. These assertions exercise the prototype; they are not a failing
before/passing after production regression.

From the repository root, with Bun and native version 10.0.6:

```bash
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/audit.py --out /tmp/thermal-spoke-audit
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
kicad-cli pcb export svg --layers F.Cu --mode-single --page-size-mode 2 --exclude-drawing-sheet -o /tmp/thermal-spoke-baseline.svg /tmp/thermal-spoke-audit/1-baseline/after.kicad_pcb
kicad-cli pcb export svg --layers F.Cu --mode-single --page-size-mode 2 --exclude-drawing-sheet -o /tmp/thermal-spoke-protected.svg /tmp/thermal-spoke-audit/1-protected/after.kicad_pcb
python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/render.py /tmp/thermal-spoke-baseline.svg /tmp/thermal-spoke-protected.svg /tmp/thermal-spoke-comparison.svg
rsvg-convert /tmp/thermal-spoke-comparison.svg -o /tmp/thermal-spoke-comparison.png
```

Use a new output directory. `results.json` records source/input hashes,
metadata, guard dimensions, all engine reports and native counts. `reports/`
retains twelve complete native DRC reports, six SES/engine/metadata outputs,
six routed native boards and subprocess logs. `manifest.json` hashes committed
evidence. The image contains actual native F.Cu exports of repeat 1 after
refill, without reconstructed copper geometry.

All 80 engine/type files and active tests are byte-identical to main `69cf598`.
No frozen benchmark was rerun: its historical exact-source full summary stays
39/78 passing runs, 13/26 cases valid 3/3, 120 opens, 27 new thermal errors.
The existing native fixture's provenance and license remain in the parent
directory. A production strategy still needs reliable native thermal metadata,
spoke selection/ownership, and full-suite native nonregression validation.

## Direction selection diagnostic

`directions.py` applies the same guard construction to each of four cardinal
sides of this one axis-aligned rectangular pad. It does not discover actual
spokes or zone connectivity. Three repeats per direction use identical native
input, exported DSN, seed 1, defaults, and cores 20–25. Production engine and
test hashes are checked before/after. Native settings and retained copper are
checked for every imported candidate.

| Direction, three repeats each | Initial guard conflicts | Intended route complete | Native thermal errors after refill, each |
| --- | ---: | ---: | ---: |
| Downward | 0 | 3/3 | 0 |
| Leftward | 0 | 3/3 | 1 |
| Upward | 2 each | Not attempted | Not measured |
| Rightward | 1 each | Not attempted | Not measured |

All native inputs have zero errors and two opens. Both imported directions
leave one unrelated native open, so complete native board passes remain 0/3.
Upward/rightward guards overlap existing foreign copper; their nonzero runner
exit is an explicitly asserted preflight rejection, with complete diagnostic
reports retained. Unexpected exceptions fail the audit. No SES is produced
for those rejected candidates. These are not native benchmark attempts.

A clear engine fence is insufficient to select a viable thermal spoke:
leftward still starves the native thermal. Selection needs native filled-zone
connectivity evidence, including whether the exterior strip reaches connected
plane copper. This experiment does not determine a general selection rule.

```bash
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/directions.py --out /tmp/thermal-directions --repeats 3
```

To render the measured pair, export `1-leftward/after.kicad_pcb` and
`1-downward/after.kicad_pcb` with the same native SVG command above, then run
`render-directions.py leftward.svg downward.svg direction-comparison.svg` and
`rsvg-convert direction-comparison.svg -o direction-comparison.png`.

`direction-results/` retains all twelve diagnostic outcomes, six imported
boards/sessions, before/after native reports, engine reports and logs.
`direction-results/summary.json` records production/test/runner hashes and
asserted results. `direction-comparison.png` shows actual native copper of the
leftward and downward candidates after refill. The former is a negative
control, not a new baseline or a production improvement.

## Filled-spoke count diagnostic

The leftward negative control preserves an existing spoke. Its failure does
not demonstrate that the selected leftward spoke lacks plane connectivity.
Sampling native filled copper shows that the route removes the *other*,
downward spoke. The raw native report explicitly says `zone min spoke count 2;
actual 1`. A strategy must account for the required number of spokes, not only
select one connected corridor. This corrects the narrower hypothesis above.

| Same input/rules; three retained routed repeats each | Input | Leftward guard | Downward guard |
| --- | ---: | ---: | ---: |
| Directions with every sampled point filled | Down + left | Left | Down + left |
| Native thermal errors, each | 0 | 1 | 0 |

`filled-spokes.py` queries native filled-zone polygons at three parallel lines
(center and ±0.127 mm), every 0.025 mm from each pad edge to 1 mm beyond it.
All three repeats give the same direction classifications. Both routed
variants retain one filled polygon outline. These are finite point samples,
not proof of full bridge width, polygon topology, or native spoke ownership.
No production selection rule, routing fix or new benchmark run is claimed.
The six boards and native reports are the cycle-73 measurements, reexamined
here rather than rerouted. `filled-results/before.kicad_pcb` is a newly refilled
copy of the unchanged native input; native settings remain unchanged.

```bash
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/filled-spokes.py --before docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/filled-results/before.kicad_pcb --out /tmp/thermal-filled-spokes
rsvg-convert /tmp/thermal-filled-spokes/comparison.svg -o /tmp/thermal-filled-spokes/comparison.png
```

The JSON retains every sample and SHA-256 hashes of the input, six routed
boards and six native reports. The PNG is a chart of these measured samples;
the actual native copper render remains `direction-comparison.png`.

## Preserving both known spokes

The next paired experiment explicitly supplies **both** known existing spokes,
downward and leftward. It compares this pair against the leftward negative
control on the same miniature, host, cores 20–25, seed 1 and default settings.
Three fresh native import/refill runs per variant retain identical native rules,
settings, original copper and normalized DSN. The guard rectangles are still
selected manually; no production engine or adapter code changes.

| Three repeats each; values per repeat | Left guard | Down + left guards |
| --- | ---: | ---: |
| Initial native errors | 0 | 0 |
| Initial engine guard conflicts | 0 | 0 |
| Intended route complete | Yes | Yes |
| Native thermal errors after refill | 1 | 0 |
| Native opens before → after | 2 → 1 | 2 → 1 |
| Engine violations after routing | 0 | 0 |
| Added tracks / vias | 3 / 2 | 3 / 2 |
| Fully sampled filled corridors after refill | Left | Down + left |

This supports minimum-spoke accounting on this fixture. It does not establish
that two guards are necessary: the earlier downward-only variant also
preserves both sampled corridors. Both new variants remain 0/3 complete native
board passes because the unrelated retained-net open remains. The finite
three-line samples do not prove full bridge width or general connectivity.
The original frozen suite's 27 thermal errors remain unresolved.

```bash
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/directions.py --combined --out /tmp/thermal-combined --repeats 3
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/combined-spokes.py /tmp/thermal-combined
rsvg-convert /tmp/thermal-combined/comparison.svg -o /tmp/thermal-combined/comparison.png
```

`combined-results/` retains all six native inputs/outputs, sessions, full native
DRC reports, engine reports, metadata, subprocess logs, source hashes and every
filled-copper sample. `comparison.png` is generated from those measurements.
`checks.log` records the required unchanged-engine checks;
`diagnostic-typecheck.log` covers the diagnostic runner separately. No timing
improvement or production safety claim is made.

### Native settings and matching project sidecars

`native-settings.py` checks nine metadata controls (three repeats each) using
identical board bytes. With project minimum-spoke counts 2 and 3, native Python
reads 2 and 3 respectively; native DRC reports zero and one thermal error
respectively (actual spokes 2). Without the project file it falls back to 2 and
reports zero thermal errors. Losing a non-default project requirement therefore
changes acceptance without changing the board. These are diagnostic rule controls,
not proposed repairs or benchmark results. Each input retains two native opens.

On this inherited-gap fixture, `zone.GetThermalReliefGap()` returns 508000 nm,
`pad.GetLocalThermalGapOverride()` returns `None`, and
`zone.GetThermalReliefGap(pad)` returns 0. The pad-argument result must not be
assumed to be the effective zone gap. The bridge width is also 508000 nm and the
pad bridge override is absent. These observations do not define a general
resolver: custom rules, footprint/pad overrides, shapes and plane connectivity
remain unhandled. No production engine or adapter changes are made.

Run from the repository root with native version 10.0.6 and a fresh directory:

```bash
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/native-settings.py --out /tmp/thermal-native-settings
rsvg-convert /tmp/thermal-native-settings/comparison.svg -o /tmp/thermal-native-settings/comparison.png
```

`native-settings-results/` retains all nine original boards, project/rule
sidecars when present, raw native reports, API snapshots, subprocess logs, hashes
and the measured chart. No routing was performed and no frozen score is changed.

### Snapshot validation covers native property extraction

The diagnostic previously validated identity immediately after loading the board,
before reading thermal properties. A change during a getter could therefore
escape validation, returning stale metadata with an apparently valid identity.
The snapshot now reads every property, then validates the complete input bundle.
Board/project digest fields come from that validated identity rather than extra
filesystem reads. Persistent changes during extraction reject the snapshot.
This does not detect change-and-restore sequences or provide atomic transactions.

| Same controls, same host, three repeats each | Before | After |
| --- | ---: | ---: |
| Four snapshot controls passing per repeat | 1/4 | 4/4 |
| Existing identity controls passing per repeat | 9/9 | 9/9 |
| Native thermal errors: project min 2 / min 3 / absent | 0 / 1 / 0 | 0 / 1 / 0 |
| Native opens per input | 2 | 2 |

The new tests mutate board/project/rule bytes during the final native getter;
the unchanged-bundle control still succeeds. The native comparison uses the
previous cycle's retained nine controls and nine fresh checks of identical input
bytes. No routing benchmark was performed; engine code and frozen scores remain
unchanged. General thermal protection is still unresolved.

```bash
python3 -B docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/test_snapshot_identity.py
python3 -B docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/test_metadata_identity.py
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/native-settings.py --out /tmp/thermal-snapshot-controls
```

`snapshot-results/` retains three baseline/candidate regression logs, identity
controls, all fresh native inputs/reports/snapshots, the summary and measured
chart. Baseline snapshot source is available at commit `0c24d94`.

### Full-width corridor area audit (cycle 79)

`area-corridors.py` subtracts the existing native filled polygon from a cardinal
rectangle 0.508 mm wide and 1 mm long beyond the rectangular pad's bounding edge.
It reads the exact previously measured filled boards (SHA256 checked against the
sample audit); it does not route or refill. Native integer polygon booleans
measure missing positive area, without inferring coverage from point samples.

Six controls exercise solid coverage, a 1 um transverse slit between sample
positions, missing outer width, a small enclosed hole, unchanged source polygons,
and rejection of degenerate rectangles. Three repeats pass 6/6; a deliberately
insufficient sampled implementation passes 3/6, missing all three area defects.
This is a diagnostic mutation comparison, not an engine regression measurement.

On all three retained downward-guard outputs, the old three-line samples report
both down and left as filled, but the full downward strip lacks 1514288654 nm²
(0.001514288654 mm²). The left strip is fully covered. Original input has both
strips covered; leftward-guard outputs have only the left strip covered. Native
DRC previously accepted the downward-guard outputs. Thus this requested full
rectangle is stricter than the native spoke criterion; do not use it as a spoke
counter or production acceptance gate. It also does not establish connection to
the plane, resolve effective rules, cover arbitrary pad shapes, or measure
zero-area boundary differences.

```bash
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 90 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/run_corridor_controls.py --out /tmp/thermal-area-controls
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 90 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/area-corridors.py --out /tmp/thermal-area-native
rsvg-convert /tmp/thermal-area-native/comparison.svg -o /tmp/thermal-area-native/comparison.png
bun run typecheck && bun run check:layers && bun run test
```

Raw control logs, measurements, and the plotted comparison are in `area-results/`.
No new routing benchmark, native DRC result, or frozen-score gain is claimed.
