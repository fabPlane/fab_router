The latest experiment replaces only an interior track interval with a five-segment detour, preserving both original endpoints and distant copper. It searches two nearest foreign tracks, two interval radii and ten signed offsets. Geometry controls cover four orientations, continuity, exact horizontal coordinates, deterministic identifiers, unchanged width/layer/net, and degenerate or endpoint-limited intervals. Native validation still requires a strict error subset, preserved terminal connectivity, no increase in opens and identical checked design/rules.

Same composed input board, same host and native version, three repeats per target. Counts below are per repeat. **No repair was accepted; this is a negative diagnostic result.**

| Static diagnostic | Before | Local detour result |
| --- | ---: | ---: |
| U1.53: selected errors / opens | 4 / 15 | 4 / 15 |
| U1.53: eligible / skipped proposals | — | 0 / 40 |
| U1.48: selected errors / opens | 4 / 15 | 4 / 15 |
| U1.48: eligible / skipped proposals | — | 20 / 20 |
| U1.48: accepted target searches | — | 0/3 |

U1.53's two nearest tracks leave insufficient interior length around the projection of the pad. Every checked U1.48 proposal retains the target thermal failure. All rejected proposals return exact input bytes. The retained evidence contains 66 native checks in total, with complete schedule/design/rule/report/partition replay. No production engine or adapter code changed.

![Measured local detour coverage](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/local-detour-results/comparison.png?raw=true)

Reproduce the local experiment from the repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
scratch=$(mktemp -d /tmp/local-detour.XXXXXX)
gzip -dc "$asset/local-detour-results/source.kicad_pcb.gz" > "$scratch/source.kicad_pcb"
cp "$asset/local-detour-results/source.kicad_pro" "$scratch/source.kicad_pro"
cp "$asset/local-detour-results/source.kicad_dru" "$scratch/source.kicad_dru"
/usr/bin/python3 "$asset/local-detour-controls.py"
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 "$asset/local-detour.py" --source "$scratch/source.kicad_pcb" --pad 12cbe2ed-3861-4e0e-89f1-6c66f25e5228 --out "$scratch/u153"
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 "$asset/local-detour.py" --source "$scratch/source.kicad_pcb" --pad af425661-704d-45af-ac80-3e8e4d16dab8 --out "$scratch/u148"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$asset/verify-local-detour.py" "$scratch/u153" --source "$scratch/source.kicad_pcb"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$asset/verify-local-detour.py" "$scratch/u148" --source "$scratch/source.kicad_pcb"
bun run typecheck && bun run check:layers && bun run test
```
