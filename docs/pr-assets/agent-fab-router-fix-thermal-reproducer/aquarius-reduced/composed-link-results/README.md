# Composed additive thermal repair

Offline diagnostic on the previously repaired witness. The source is exactly the prior U1.53 selected bytes, with its unchanged native rule sidecars. This is a static fixture repair, not an engine or adapter implementation or a frozen-suite improvement.

On the same host, cores 20–25, three repeats, the C1.2 search tests pad-relative directions in order at each of three widths (0.127, 0.254, 0.508 mm), stopping at acceptance. Each repeat accepts direction 6 at 0.127 mm after seven proposals. Link length is 1.524 mm. Each baseline has three native thermal errors and 15 opens; selected boards have two thermal errors and 15 opens. No terminal pairs are lost, every existing node remains, and exact rules and checked design identities are preserved. The U1.53 repair survives. Remaining thermal targets are U1.46 and U1.48.

| Same static board | Repeats | Native errors per repeat | Opens per repeat | Accepted |
|---|---:|---|---|---|
| Before C1.2 link | 3 | 3 / 3 / 3 | 15 / 15 / 15 | — |
| After C1.2 link | 3 | 2 / 2 / 2 | 15 / 15 / 15 | 3/3 |

These are 24 fresh native checks: three baselines and 21 proposals. Full frozen reference remains 39/78 passed, 13/26 valid, 120 opens and 27 added thermal errors; no router run was performed this cycle, so no router-history row is appropriate.

From repository root, using native Python with pcbnew and the native checker installed:

```bash
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
D=/tmp/composed-thermal-link
mkdir -p "$D"
gzip -dc "$A/composed-link-results/source.kicad_pcb.gz" > "$D/source.kicad_pcb"
cp "$A/composed-link-results/source.kicad_pro" "$D/source.kicad_pro"
cp "$A/composed-link-results/source.kicad_dru" "$D/source.kicad_dru"
/usr/bin/python3 "$A/link-controls.py"
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 "$A/thermal-links.py" --source "$D/source.kicad_pcb" --target 0058b9c6-73af-4ba8-a061-fb00a457a84f --out "$D/native"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$A/verify-links.py" "$D/native" --source "$D/source.kicad_pcb"
/usr/bin/python3 "$A/verify-links.py" "$A/composed-link-results/native" --source "$D/source.kicad_pcb"
bun run typecheck && bun run check:layers && bun run test
/usr/bin/python3 "$A/render-links.py" "$A/composed-link-results"
```

The replay verifies manifest confinement/hashes, candidate bytes/schedule, additive edit boundary, pad/net/layer/width, native checked design and rule bytes, DRC findings, terminal partitions, acceptance, selected bytes and repeat stability. Existing evidence without explicit target metadata keeps its original target default.
