This diagnostic adds one same-net track from U1.53 toward its plane without changing existing copper, pads, zones or rules. It derives the layer from the pad's copper layer set and same-net zones: the native pad's `GetLayer()` alone reports front copper for this back-side pad. A native control covers that distinction. The bounded schedule tries eight pad-relative directions and widths 0.127, 0.254 and 0.508 mm (one-quarter, one-half and one stored zone gap), with length 1.524 mm. These are search dimensions, not changes to native constraints.

Same composed board, exact rule sidecars, host and cores 20–25; native version 10.0.6; three repeats:

| Static native measurement | Original | Selected after search |
| --- | ---: | ---: |
| Native errors per repeat | 4 | 3 |
| Opens per repeat | 15 | 15 |
| U1.53 thermal present | 3/3 | 0/3 |
| Lost connected terminal pairs | — | 0 |
| Accepted repairs | — | 3/3 |

Each repeat rejects its first two candidates and accepts direction 2 at width 0.127 mm. The accepted link removes exactly the target thermal finding without adding any native error; the three remaining errors are the existing thermal findings at C1.2, U1.46 and U1.48. Native saved design identity, both exact rule sidecars and terminal inventory/partitions pass. The three selected files have identical SHA-256 `86b63c31f6331c6acdfafc5b13aa2ce82393fde2a14bd1d0f24f847783e3a9e6`.

The earlier complete search at widths 0.254/0.508 mm is retained separately under `wide-native`: 51 native checks, zero accepted searches. Two of its sixteen candidates remove the target each repeat. The 0.254 mm link replaces it with clearance 0.0701 mm versus required 0.1270 mm; the 0.508 mm link adds a short and two clearances. All wider proposals preserve terminal pairs and checked design/rules, but their errors or lack of improvement reject them. The narrower final search comprises 12 native checks (three baselines plus nine proposals). This provides a measured fixture-specific static repair, not a production engine algorithm or live adapter safety guarantee.

Initial exploratory runs used the wrong layer/net representation; another complete preliminary search selected the wrong layer through `GetLayer()`. All are excluded, retained only in private scratch, and neither justify the table nor appear in these published native result folders. Final layer membership is independently checked during replay. Geometry controls began with a missing-module failure and now cover 72 deterministic candidates, additive-only edits, net/layer/width, radius, input immutability, invalid scales and a native back-pad layer control. This is new diagnostic coverage, not an existing engine regression claim.

![Measured thermal-link results](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/link-results/comparison.png?raw=true)

Reproduce from the repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
scratch=$(mktemp -d /tmp/thermal-links.XXXXXX)
gzip -dc "$asset/link-results/source.kicad_pcb.gz" > "$scratch/source.kicad_pcb"
cp "$asset/link-results/source.kicad_pro" "$scratch/source.kicad_pro"
cp "$asset/link-results/source.kicad_dru" "$scratch/source.kicad_dru"
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/link-controls.py"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/thermal-links.py" --source "$scratch/source.kicad_pcb" --out "$scratch/native"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-links.py" "$scratch/native" --source "$scratch/source.kicad_pcb"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-links.py" "$asset/link-results/native" --source "$scratch/source.kicad_pcb"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-links.py" "$asset/link-results/wide-native" --source "$scratch/source.kicad_pcb"
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/summarize-lane.py" "$scratch/native" > "$scratch/analysis.json"
/usr/bin/python3 "$asset/render-links.py" "$asset/link-results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Independent raw and compressed replay checks every scheduled candidate, additive edit boundary, candidate bytes, saved design/rules, actual native findings, terminal partitions, acceptance and selected bytes. Complete manifests bind the retained artifacts. Native sidecar trailing blank lines remain byte-exact.

Production engine and adapter code are unchanged. The unchanged frozen full-suite reference is 39/78 passing attempts, 13/26 cases valid three of three, 120 opens and 27 new thermal errors; it was not rerun and no frozen-suite improvement is claimed. General thermal repair and atomic native validation remain unresolved. Required checks pass: typecheck, 65 layer-checked files with zero violations, 859 tests with zero failures (398454 assertions; 247.96 seconds).
