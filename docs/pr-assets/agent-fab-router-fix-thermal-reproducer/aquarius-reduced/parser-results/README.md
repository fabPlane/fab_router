The offline native evidence parser previously returned the last completed S-expression, ignoring preceding roots and accepting some incomplete enclosing trees. A changed board followed by the original board therefore had the same design signature as the original alone. The parser now requires exactly one complete tree, with no stray atoms or invalid quote fragments. Invalid input raises `ValueError` before the native callback or design identity check can use a partial tree. The checked-design and terminal guards remain unchanged.

Regression written and observed failing before the fix. Same host, cores 20–25, same 12 cases, three repeats:

| Parser / identity controls | Before | After |
| --- | ---: | ---: |
| Valid complete trees accepted and round-tripped | 9/9 | 9/9 |
| Invalid trees rejected with ValueError | 0/27 | 27/27 |
| Correct outcomes | 9/36 | 36/36 |

Invalid cases cover two boards, a changed first board hidden by the original, an unfinished second root, an unfinished parent, leading/trailing atoms, extra close, empty input and an unterminated quote. Some prior invalid cases raised unrelated exceptions; the table requires consistent ValueError rejection. Three valid controls cover nested geometry, whitespace, signed decimals, parentheses inside quoted strings and escaped quotes. `signature-collision.log` reproduces the actual prior design-signature equality and subsequent rejection. The independent retained two-axis replay still passes all 75 checks: candidate schedule/bytes, designs, sidecars, native reports, terminal partitions and repeat stability.

This fixes an offline diagnostic, not production routing. No new native refill/DRC run, router benchmark, thermal repair, speed improvement or pin bump is claimed. Engine and adapter source are unchanged. Frozen reference: 39/78 passes, 13/26 cases valid 3/3, 120 opens, 27 unresolved new thermal errors.

Reproduce from repository root (system Python with native bindings):

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 60 /usr/bin/python3 "$asset/parser-controls.py"
scratch=$(mktemp -d /tmp/parser-replay.XXXXXX)
git show "052b2b4:$asset/native.py" > "$scratch/native-before.py"
# Expected exit 1: prior parser fails these controls.
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 60 /usr/bin/python3 "$asset/parser-controls.py" --parser-source "$scratch/native-before.py"
gzip -dc "$asset/two-axis-results/source.kicad_pcb.gz" > "$scratch/source.kicad_pcb"
cp "$asset/two-axis-results/source.kicad_pro" "$scratch/source.kicad_pro"
cp "$asset/two-axis-results/source.kicad_dru" "$scratch/source.kicad_dru"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$asset/verify-junction-two-axis.py" "$asset/two-axis-results/native" --source "$scratch/source.kicad_pcb"
python3 "$asset/render-parser.py" "$asset/parser-results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native evidence parser controls](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/parser-results/comparison.png?raw=true)

Required checks pass: typecheck, 65 layer-checked files with zero violations, 859 tests / zero failures / 398454 assertions (226.55 seconds). Raw output is retained in `checks.log`.
