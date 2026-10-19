# Rejected additive thermal links at U1.48

This offline diagnostic starts from the exact two-link board selected by the prior composed search (SHA256 `8c77e1838310cefd7c1b211badf8c63aa4cea8a7bd18b1b2163096cf7354248a`). Existing links, all other design nodes and native rule sidecars are retained. No production engine or adapter changes are included.

Same machine, cores 20–25, three repeats: eight pad-relative directions at each of three widths (0.127, 0.254, 0.508 mm), each link 1.524 mm long. Every repeat rejects all 24 proposals. Every proposal retains U1.48's thermal error. Candidate errors range from two to six and opens from 14 to 15. A lower open count never overrides new DRC errors. All three selected boards exactly equal the source bytes; the two prior accepted links survive unchanged.

| Same static board | Repeats | Native errors per repeat | Opens per repeat | Accepted |
|---|---:|---|---|---|
| Before U1.48 search | 3 | 2 / 2 / 2 | 15 / 15 / 15 | — |
| Selected after search | 3 | 2 / 2 / 2 | 15 / 15 / 15 | 0/3 |

These are 75 fresh native checks (three baselines and 72 proposals), not router benchmark runs. U1.46 and U1.48 remain unresolved. Frozen-suite reference remains 39/78 passed, 13/26 valid, 120 opens and 27 added thermal errors. No routing gain is claimed and no router-history row is appropriate.

From repository root, with native Python, pcbnew and the native checker installed:

```bash
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
D=/tmp/u148-thermal-links
mkdir -p "$D"
gzip -dc "$A/u148-link-results/source.kicad_pcb.gz" > "$D/source.kicad_pcb"
cp "$A/u148-link-results/source.kicad_pro" "$D/source.kicad_pro"
cp "$A/u148-link-results/source.kicad_dru" "$D/source.kicad_dru"
/usr/bin/python3 "$A/link-controls.py"
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 "$A/thermal-links.py" --source "$D/source.kicad_pcb" --target af425661-704d-45af-ac80-3e8e4d16dab8 --out "$D/native"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$A/verify-links.py" "$D/native" --source "$D/source.kicad_pcb"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$A/verify-links.py" "$A/u148-link-results/native" --source "$D/source.kicad_pcb"
bun run typecheck && bun run check:layers && bun run test
```

Raw and compressed replays verify the full schedule, candidate bytes, additive edit boundary, checked designs, exact rules, native findings, terminal partitions, acceptance, selected bytes and repeat stability. Publication manifests bind all native artifacts. Required checks pass: typecheck, layer checks, 859 tests (398454 assertions).
