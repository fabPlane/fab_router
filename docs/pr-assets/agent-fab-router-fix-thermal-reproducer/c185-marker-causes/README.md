# Discover complete-board thermal causes from native markers

Earlier complete Aquarius repairs required known causal copper identifiers. This
bounded offline experiment takes only the original input, complete routed source,
and native thermal findings. No causal UUID, footprint label, or previous findings
file is supplied. The inherited native helper also emits a legacy single-pad
`target` diagnostic field; discovery and acceptance ignore it and use the complete
error multiset. It ranks eight generated segments and eight generated vias per
thermal marker, unions the candidates, and probes single-item deletions against
the complete source. Track ranking uses the existing layer-aware pad-marker
ranking. Via ranking uses the board's declared copper stack, so blind and buried
spans can be checked against the affected zone layer. Both exclude original copper.

A faithful deletion that strictly reduces the error multiset identifies a causal
hypothesis, even when it loses terminal connections. Such a deletion is never
implicitly publishable. Each discovered cause is reconsidered on the current
complete board: try deletion, then up to eight endpoint-preserving track detours
or eight connected via displacements. Every accepted candidate must strictly
reduce native errors, retain the terminal inventory and every previously connected
terminal pair, add no opens, preserve the source metadata and original copper,
and retain exact native project/custom-rule sidecars. Saved-board identity checks
reject evidence from native net reassignment. A partially repaired result is not
published: the exact initial source is returned unless the entire board is clean.

Four new discovery tests cover layer spans, protected copper, pad versus zone
marker positions, deterministic ties, missing pad markers and bounded budgets.
The initial missing-module failure is new diagnostic coverage, not an engine
regression. Production engine and adapter sources are unchanged. These are native
refill experiments, not router seeds or scored benchmark results. The recorded
26-case, three-seed summary remains 39/78 passes, 13/26 valid cases, 120 opens and
27 new thermal errors; no full-suite rerun or integration pin bump is claimed.

Same complete Aquarius source/input/rules, native 10.0.6 and machine
`hyper-ms-lin`, cores 20–25. The earlier guarded known-cause sequence and this fresh
marker-driven search each have three native repeats; source/input/sidecar bytes
match both earlier comparison arms exactly.

| Offline configuration | Supplied causal IDs | Source errors / opens | Selected errors / opens | Repeats |
| --- | ---: | ---: | ---: | ---: |
| Earlier guarded supplied-cause sequence (c184) | 6 | 6 / 15 | 0 / 14 | 3 |
| Marker-driven discovery (c185) | 0 | 6 / 15 | 0 / 14 | 3 |

The search discovers 69 candidates and seven deletion causes per repeat,
including a previously untested R20 causal via. Moving that via +0.5 mm in Y
replaces the earlier R20 track detour in the selected sequence. Six stages are
accepted per repeat; final bytes, error multisets, opens and terminal partitions
agree three times. All 291 native checks are retained:
291 faithful, 0 identity rejections,
1530 aggregate errors and 4464 aggregate opens including rejected
probes/intermediates. These aggregates are not router scores. Fourteen opens
remain; no complete routing success is claimed.

Validation: typecheck and layer checks pass; 859 engine tests pass (398454
assertions, 233.29 seconds). Four new discovery tests and 17 inherited source,
via-ownership and detour tests pass. Original and extracted-archive replay pass.

Provenance and license: [complete source](../c176-aquarius-search/README.md),
[license](../aquarius-reduced/LICENSE). The archive contains disposable copies;
frozen inputs, checker and shared runtime are untouched. Independent replay checks
all proposal bytes, protected source nodes, saved identity, rule files, native
findings, terminal partitions, causal classifications, sequential acceptance,
publication/rollback and repeat agreement.

Reproduce from the repository root:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/marker-causes
# Use a fresh disposable directory.
tar -xJf "$R/c185-marker-causes/native.tar.xz" -C /tmp/marker-causes
/usr/bin/python3 -B "$R/c185-marker-causes/test_discovery.py"
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c185-marker-causes/verify.py" --root /tmp/marker-causes/evidence
# Fresh execution from archived source copies, retaining archived results.
taskset -c 20-25 nice -n 10 timeout 3600 /usr/bin/python3 -B "$R/c185-marker-causes/measure.py" --source /tmp/marker-causes/evidence/source/board.kicad_pcb --input /tmp/marker-causes/evidence/input/board.kicad_pcb --out /tmp/marker-causes/fresh
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c185-marker-causes/verify.py" --root /tmp/marker-causes/fresh
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native-marker causal discovery](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c185-marker-causes/comparison.png?raw=true)
