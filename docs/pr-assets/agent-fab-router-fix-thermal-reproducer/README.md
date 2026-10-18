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
