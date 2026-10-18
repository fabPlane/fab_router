# Native thermal-starvation reproducer (unresolved)

A 10 × 10 mm reduction of ground pad U1-7 from the frozen `qrpcard-qrpcard-j2-small`
output reproduces the native thermal failure with one pad, two 0.25 mm tracks,
one 0.6/0.4 mm through via and one front-copper zone. The source board is MIT
licensed, copyright 2016 devttys0; see LICENSE. The outline and zone polygon were
cropped for diagnosis, all other footprints/pads and distant copper were removed,
and the retained footprint graphics/model were stripped. No frozen benchmark
input, native checker or routing setting was modified.

The zone retains a 0.508 mm thermal gap and 0.508 mm bridge width. Stock KiCad
10.0.6 requires two spokes but finds one after refill. Removing **any one** of
the three copper obstacles gives zero thermal errors. Each condition is checked
three times with unchanged pad/zone/rule definitions. These deletion controls
identify a necessary obstruction set; they are **not a proposed repair**.
The full unmodified benchmark separately confirms two thermal errors per run.

The all-copper DSN export retains the pad, two tracks, via and zone polygon,
and `checkDrc` reports zero violations and zero terminal incompletes. DSN export
has no native thermal-gap, bridge-width or minimum-spoke metadata, and the
engine's `Pour` model has no thermal properties. Consequently engine clearance
acceptance cannot establish native thermal acceptance. The fixture describes
the model gap, not a regression in native SES import, and no routing fix is
included here. It does not prove a particular future thermal algorithm correct.

The reduced boards have dangling copper and native unconnected items because
remote endpoints were deliberately removed. The audit records those findings;
none of these reduced boards is claimed as a valid routing-benchmark result.

Run from the repository root on the same Linux host with stock KiCad 10.0.6,
its `/usr/bin/python3` pcbnew module, kicad-cli and Bun installed:

```bash
taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/audit.py --out /tmp/thermal-audit
bun run typecheck && bun run check:layers && bun run test
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 1800 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --case qrpcard-qrpcard-j2-small --out /tmp/thermal-native-qrp
```

Output directories must not already exist. `audit.py` asserts the **known failure**
and its deletion controls, exports DSN, invokes the separate engine check, and
retains raw native DRC reports. When a thermal-aware fix exists, add a routing
acceptance regression that expects zero native errors after routing; do not
mistake this diagnostic audit for that regression.

`measurements.json` captures the historical/current frozen subset, historical
full-suite summary (not rerun), source/hash checks and unit results.
`native-audit.json` contains all 12 diagnostic checks. `native-drc.json` retains
the complete all-copper native report; `thermal.dsn` is its exported engine input. The PNG shows actual
native front-copper exports after refill, with and without the via.

```bash
kicad-cli pcb export svg --layers F.Cu --mode-single --page-size-mode 2 --exclude-drawing-sheet -o /tmp/thermal-audit/all.svg /tmp/thermal-audit/all-copper-1/board.kicad_pcb
kicad-cli pcb export svg --layers F.Cu --mode-single --page-size-mode 2 --exclude-drawing-sheet -o /tmp/thermal-audit/control.svg /tmp/thermal-audit/without-1-via-1/board.kicad_pcb
python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/render.py /tmp/thermal-audit/all.svg /tmp/thermal-audit/control.svg /tmp/thermal-audit/comparison.svg
rsvg-convert /tmp/thermal-audit/comparison.svg -o /tmp/thermal-audit/comparison.png
```

## Route-producing native failure

`route-input.kicad_pcb` extends the reduction with two remote 0.25 mm SMD
terminals at (77, 132.588) and (83, 132.588), replacing the lower track, plus
one terminal wholly inside the retained via's copper to retain its net in DSN.
The original thermal pad, zone, upper track and via are preserved. References
are named and hidden. This is a synthetic diagnostic derived from the same MIT
board, not an additional frozen benchmark case.

Unlike the original all-copper fixture, this input has **zero native errors**
after refill. Three runs of `routeDsn` (seed 1, default settings), stock native
SES import and refill each introduce one `starved_thermal` error. The engine
reports one completed connection, zero terminal incompletes and zero added
violations. Native opens fall from two to one, while the dangling-track and
dangling-via warnings remain. No clearance or shorting error is present.
The router chooses a route with three tracks and two vias; the figure shows
actual front-copper exports. No copper is manually repaired after routing.

| Same diagnostic input, same host, 3 repeats | Before routing | After routing/import/refill |
| --- | ---: | ---: |
| Native errors per repeat | 0 | 1 thermal |
| Native opens per repeat | 2 | 1 |
| Engine terminal incompletes | 1 | 0 |
| Engine added violations | — | 0 |

```bash
taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/route-audit.py --out /tmp/thermal-route-known-failure
# Future safety target; currently exits 1 after retaining all three native reports:
taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/route-audit.py --expect-safe --out /tmp/thermal-route-acceptance
```

The default audit asserts the known failure. `--expect-safe` expects zero native
thermal errors, and currently fails. It is an explicit future acceptance target,
not a passing safety regression. Raw before/after DRC reports, exported input DSN,
returned SES, engine reports and native output boards remain in each output
folder. `route-audit.json` records the three known-failure runs. Use the same SVG
export commands above with `before.kicad_pcb` and `after.kicad_pcb`, then
`render-route.py` instead of `render.py`, to reproduce `route-comparison.png`.
A production thermal-aware fix is still required; it must also address the
remaining native open rather than treating this diagnostic as a routed pass.

## Paired native thermal metadata diagnostic

`thermal-metadata-audit.py` compares the original synthetic route-producing
input with a diagnostic whose **only input change** is zone thermal gap
0.508 → 0.254 mm. It asserts that reversing that field edit restores the entire
original input text. This changes a native setting solely to isolate the model
gap; it is not a proposed routing repair and never touches frozen inputs.

Across three repeats of each variant, exported DSNs are byte-identical after
replacing only their quoted design filename. Returned SES files are likewise
byte-identical after replacing only their design filenames. All routing data,
placement, rules and copper records in those exports remain in the comparison.
Nevertheless, stock native import/refill finds different thermal acceptance:

| Same synthetic geometry/host, 3 repeats each | Original 0.508 mm gap | Diagnostic 0.254 mm gap |
| --- | ---: | ---: |
| Native errors before routing, each | 0 | 0 |
| Native thermal errors after routing, each | 1 | 0 |
| Native opens before → after, each | 2 → 1 | 2 → 1 |
| Engine incompletes before → after, each | 1 → 0 | 1 → 0 |
| Engine added violations, each | 0 | 0 |

This establishes a concrete pair of native inputs whose thermal distinction
is absent from DSN. A DSN-only engine cannot distinguish their native thermal
acceptance from these exports. A future solution needs native thermal context
or native validation in addition to ordinary geometric clearance. Rejecting
copper also needs a completion strategy; both diagnostic variants still have
one native open. The remaining native open joins the retained dangling track
to the retained via/T2 component on a different net from the new T0–T1
connection (native reports may choose the via or pad as its representative);
the audit asserts the affected net and retained-track endpoint as its
classification after every import. No production fix or benchmark improvement
is claimed.

```bash
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/thermal-metadata-audit.py --out /tmp/thermal-metadata-audit
kicad-cli pcb export svg --layers F.Cu --mode-single --page-size-mode 2 --exclude-drawing-sheet -o /tmp/thermal-metadata-original.svg /tmp/thermal-metadata-audit/1-original/after.kicad_pcb
kicad-cli pcb export svg --layers F.Cu --mode-single --page-size-mode 2 --exclude-drawing-sheet -o /tmp/thermal-metadata-control.svg /tmp/thermal-metadata-audit/1-gap-control/after.kicad_pcb
python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/render-metadata.py /tmp/thermal-metadata-original.svg /tmp/thermal-metadata-control.svg /tmp/thermal-metadata-comparison.svg
rsvg-convert /tmp/thermal-metadata-comparison.svg -o /tmp/thermal-metadata-comparison.png
```

`thermal-metadata-results.json` retains six engine reports, native findings,
input hashes and normalised DSN/SES hashes. Full native boards, unnormalised
exports and raw checker reports remain in the requested output folder.
Exploratory bridge widths 0.254/0.3/0.4/0.508 mm all retained the error;
thermal gaps 0.127/0.254 mm and solid connection removed it, while 0.8 mm retained
it. Those single-run probes motivated the paired repeated audit and are not
scored benchmarks or repairs. The original native rules remain the safety target.
