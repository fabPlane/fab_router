# Bent additive links remove the remaining static thermal errors

A narrow two-segment link at U1.48 removes both remaining thermal errors on the exact two-link source board (SHA256 `8c77e1838310cefd7c1b211badf8c63aa4cea8a7bd18b1b2163096cf7354248a`). The prior straight-ray search retained U1.48's error in all 24 proposals per repeat. This experiment changes the topology: exit by one quarter of the stored thermal gap, then turn perpendicular for three gaps. It adds copper without moving or removing any existing design node.

The schedule contains eight pad-relative initial directions and two perpendicular turns at 0.127 mm width. Each of three repeats rejects the first eleven proposals and accepts direction 5, turn +1: from (170.018581, 51.596381) mm to (170.018581, 51.469381), then (171.542581, 51.469381), on the GNDD back copper plane. Candidate 11 removes the target error but adds shorts/crossing errors and is rejected; candidate 12 removes both U1.48 and U1.46 errors without new errors. All selected files have SHA256 `e15b73db07a31b28d1a952c136d0b8d194cce3e590a33c06e7be6af7f74c6cfc`.

Same static board, machine and rules, cores 20–25, three repeats:

| Static native measurement | Repeats | Errors | Opens | Accepted |
|---|---:|---|---|---|
| Before bent-link search | 3 | 2 / 2 / 2 | 15 / 15 / 15 | — |
| Selected after search | 3 | 0 / 0 / 0 | 15 / 15 / 15 | 3/3 |

These are 39 fresh native checks (three baselines and 36 proposals), not router benchmark runs. Candidate errors range from zero to six; all candidates have 15 opens. Exact native design/rule identity, complete terminal inventory and no lost connected terminal pairs are required before acceptance. Existing U1.53 and C1.2 links remain unchanged. The selected bytes are the proposed design, while retained native boards include freshly computed fills.

This is a fixture-specific offline repair, with no engine or adapter changes and no atomic live-board transaction guarantee. It does not establish a general routing policy or a frozen-suite improvement. The full-suite historical reference remains 39/78 passed, 13/26 valid, 120 opens and 27 new thermal errors; that suite was not rerun for unchanged production sources. No router history row is appropriate.

From repository root, with native Python, pcbnew and the native checker installed:

```bash
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
D=/tmp/u148-bent-links
mkdir -p "$D"
gzip -dc "$A/u148-dogleg-results/source.kicad_pcb.gz" > "$D/source.kicad_pcb"
cp "$A/u148-dogleg-results/source.kicad_pro" "$D/source.kicad_pro"
cp "$A/u148-dogleg-results/source.kicad_dru" "$D/source.kicad_dru"
/usr/bin/python3 "$A/dogleg-controls.py"
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 "$A/thermal-doglegs.py" --source "$D/source.kicad_pcb" --target af425661-704d-45af-ac80-3e8e4d16dab8 --out "$D/native"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$A/verify-doglegs.py" "$D/native" --source "$D/source.kicad_pcb"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$A/verify-doglegs.py" "$A/u148-dogleg-results/native" --source "$D/source.kicad_pcb"
/usr/bin/python3 "$A/render-doglegs.py" "$A/u148-dogleg-results"
bun run typecheck && bun run check:layers && bun run test
```

Geometry controls cover 48 rotated deterministic doglegs, connected/nonzero segments, net/layer/width metadata, exact additive edit boundaries, pad-scoped identities and invalid scales. These are new diagnostic controls, not a production regression repair. Independent raw and compressed replays verify all 39 checks, complete schedules, exact candidate bytes, checked designs, native reports, rule sidecars, terminal partitions, acceptance, selected bytes and repeat stability. Manifests bind retained native artifacts. Required checks pass: typecheck, 65 layer-checked files with zero violations, 859 tests and 398454 assertions.
