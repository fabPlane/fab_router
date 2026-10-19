# Connected via displacement on reduced and complete boards

Moving the isolated causal via together with its incident track endpoints can
remove C1.2 thermal starvation on the complete Aquarius output. This diagnostic
preserves every unaffected source node, all other generated copper, via diameter,
drill, net, layer stack and track widths. On the complete board, precisely three
generated items change: via `d3812c01-5e0b-47fa-b2de-04d261bdf01e`, F.Cu track
`cf900d68-bf19-405c-828e-e774c2771825` and B.Cu track
`1adf0f37-dc56-4f22-b0f7-e01166fcee29`. The tracks' remote endpoints stay fixed.

Same original case, complete source, rules, native 10.0.6, machine hyper-ms-lin
and cores 20–25; three fresh refills per offset, not routing seeds:

| Configuration | Before errors / opens | After errors / opens | Repeats | Lost terminal pairs |
| --- | ---: | ---: | ---: | ---: |
| Reduced two-item witness, +0.5 mm X | 1 / 110 | 0 / 110 | 3 | 0 |
| Complete output, +0.5 mm X | 6 / 15 | 5 / 15 | 3 | 0 |
| Complete output, +1 mm X | 6 / 15 | 5 / 15 | 3 | 0 |
| Complete output, +0.5 mm Y, rejected | 6 / 15 | 7 / 15 | 3 | 0 |
| Complete output, −1 mm X, rejected | 6 / 15 | 7 / 15 | 3 | 0 |

All 54 checks are retained: two boards × nine offsets including unchanged control
× three repeats. All native saves preserve the exact proposed design signature
and rule sidecars. Error multisets, terminal partitions, opens and acceptance
repeat 3/3. Four reduced-witness offsets clear its thermal error; only the two
positive X offsets satisfy the strict policy on the complete output. Five other
complete-board thermal failures remain. The archive contains 186 aggregate
errors and 3375 opens including rejected diagnostic proposals, not suite scores.

Initial execution completed all checks then failed an overly strict comparison
of native finding array order. `recover.py` reconstructs rows from those saved
reports without executing checks again; the only differences are ordering of
clearance/crossing and shorting findings for two rejected negative X offsets.
`verify.py` compares exact error multisets, independently reconstructs every
coordinate edit, preserves unaffected source nodes, verifies native design signatures,
sidecars, terminal partitions and acceptance. The original full output already has native serialization differences from the
prepared input (footprints and zone fills). Unaffected-node comparisons therefore
use each exact source; the reduced witness additionally retains every input node.
Final `probe.py` reports normalized
repeat equality. Initial setup also failed before any check on an incorrect path;
that attempt is excluded and retained privately. No check exception is ignored.

The geometry test first failed because the new helper did not exist; this is
coverage for an offline tool, not a failing engine regression. Engine typecheck,
layer checks and all 859 tests pass. No engine/adapter change, scored router run,
full-suite rerun or production safety claim. Historical suite remains 39/78
passes, 13/26 valid cases, 120 opens and 27 thermal errors, unfixed.
No source board was overwritten and no diagnostic output was applied.
Provenance/license: adjacent c176-aquarius-search and aquarius-reduced/LICENSE.

Reproduce from repository root, using fresh directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c181-via-displacement
mkdir -p /tmp/via-displacement
tar -xJf "$R/native.tar.xz" -C /tmp/via-displacement
taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 -B "$R/verify.py" --root /tmp/via-displacement
/usr/bin/python3 -B "$R/test_geometry.py"
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/probe.py" --previous /tmp/via-displacement/previous --out /tmp/via-displacement/fresh
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Measured displacement outcomes](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c181-via-displacement/comparison.png?raw=true)
