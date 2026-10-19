Junction discovery previously called the mutation helper with a hypothetical (+1,+1) nm displacement. A valid shared junction next to a diagonal segment of that length throws a collapse error before any real proposal is generated. Discovery now counts coincident same-net/layer straight-track endpoints directly. Actual proposals still reject collapsed segments and still require native design, DRC and terminal checks.

| Same host and fixtures, three repeats | Before | After |
| --- | ---: | ---: |
| Positive diagonal shared junction | 0/3 | 3/3 |
| Negative diagonal shared junction | 3/3 | 3/3 |
| Ordinary shared junction | 3/3 | 3/3 |

This is an offline diagnostic regression fix. It makes no production routing or speed claim. The full frozen reference remains 39/78 passing attempts, 13/26 cases valid three of three, 120 opens and 27 new thermal errors; no new router benchmark was run for unchanged production code.

![Repeated junction selection controls](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/junction-selection-results/comparison.png?raw=true)

Reproduce from the repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
/usr/bin/python3 "$asset/junction-selection-controls.py"
/usr/bin/python3 "$asset/junction-controls.py"
scratch=$(mktemp -d /tmp/junction-selection.XXXXXX)
gzip -dc "$asset/two-axis-results/source.kicad_pcb.gz" > "$scratch/source.kicad_pcb"
cp "$asset/two-axis-results/source.kicad_pro" "$scratch/source.kicad_pro"
cp "$asset/two-axis-results/source.kicad_dru" "$scratch/source.kicad_dru"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$asset/verify-junction-two-axis.py" "$asset/two-axis-results/native" --source "$scratch/source.kicad_pcb"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

For the failing control, check out `b7aa204` in a private scratch snapshot and run the new control script against that version of the helper. `before.log` retains its three repeated failures. `after.log` retains all nine passing controls. Existing mutation controls remain passing; input geometry is unchanged by discovery.

Final verification: typecheck passes; 65 layer-checked files, zero violations; 859 tests pass, zero failures, 398454 assertions (210.29 s). Updated-helper replay passes all 75 retained native checks without rerunning native routing.
