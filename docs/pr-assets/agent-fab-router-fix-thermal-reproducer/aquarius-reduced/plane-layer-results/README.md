## Fix native multilayer-zone metadata crashes in offline diagnostics

Both additive thermal search helpers assumed a zone had one layer. Native `ZONE.GetLayer()` returns `UNDEFINED_LAYER` for a multilayer zone; forwarding that sentinel to `PAD.IsOnLayer()` segfaults. The helpers now intersect each same-net zone's complete layer inventory with the pad's layers. They retain the requirement for exactly one eligible layer and reject ambiguous or absent choices.

Regression written and run before the fix. Same host, native KiCad 10.0.6, cores 20–25, three repeats of the same control script:

| Native metadata regression | Before `4090f74` | After |
|---|---|---|
| Completed runs | 0/3 (SIGSEGV each) | 3/3 |
| Controls per completed run | Not completed | 16/16 |

The 16 controls cover both helpers: front/back single or multilayer plane inventory, repeated same-layer zones, foreign nets, disjoint layers and ambiguous two-layer membership. Core dumps are disabled in the comparison harness. Existing straight-link and bent-link controls pass. Replay of the retained 39 native checks still validates complete proposal bytes, rules, reports, terminal partitions and selected outcomes. That replay uses saved evidence and does not rerun native DRC. Historical evidence code hashes describe their original executions; this follow-up changes only metadata helpers and adds regression coverage.

Required checks pass: typecheck, 65 layer-checked files with zero violations, 859 tests, zero failures and 398454 assertions (214.96 seconds).

No production engine/adapter change or router benchmark was performed. The full-suite historical reference remains 39/78 passed, 13/26 valid, 120 opens and 27 new thermal errors; this fix does not claim a change to that score. No router-history row is appropriate.

From repository root (choose a new output directory):

```bash
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
/usr/bin/python3 -B "$A/plane-layer-controls.py"
taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 -B "$A/measure-plane-layers.py" --before-ref 4090f74 --out /tmp/plane-layer-comparison
/usr/bin/python3 -B "$A/link-controls.py"
/usr/bin/python3 -B "$A/dogleg-controls.py"
D=/tmp/plane-layer-replay
mkdir -p "$D"
gzip -dc "$A/u148-dogleg-results/source.kicad_pcb.gz" > "$D/source.kicad_pcb"
cp "$A/u148-dogleg-results/source.kicad_pro" "$D/source.kicad_pro"
cp "$A/u148-dogleg-results/source.kicad_dru" "$D/source.kicad_dru"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$A/verify-doglegs.py" "$A/u148-dogleg-results/native" --source "$D/source.kicad_pcb"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native metadata regression comparison](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/plane-layer-results/comparison.png?raw=true)
