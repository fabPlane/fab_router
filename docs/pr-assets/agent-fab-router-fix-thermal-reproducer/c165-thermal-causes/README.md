# Isolated copper causes of two native thermal errors

The nine copper items added by the measured qrpcard J2-small route reproduce
both thermal errors when appended to the **intact original input**. Exhaustive
singleton and pair probes isolate U2.15 to one segment and U1.7 to two connected
segments. Neither U1 segment alone produces the thermal error. This gives
smaller native regression inputs for the unresolved thermal metadata problem.
It does not implement a production fix or improve a router benchmark score.

The source is the previously measured cycle-133 seed-2 output, also retained
under `../qrpcard-auto-links/j2-small/`. Session import replaced the retained
copper UUIDs, so discovery compares native geometry/net **multisets**, including
multiplicity, instead of assuming original UUIDs survive. All 178 original
copper items match; the nine additions are seven segments and two vias on one
signal net. Each proposal starts from the original board and appends a selected
subset. No original copper, pad, footprint, zone, setup or other node is deleted
or moved. Both native sidecars remain byte-identical. The board license is
retained in `LICENSE`.

Same machine (`hyper-ms-lin`), cores 20–25, native 10.0.6, input and rules;
three independent native checks per variant:

| Static input variant | Added items | Native errors/run | Opens/run |
| --- | ---: | ---: | ---: |
| Original input | 0 | 0 | 2 |
| U1 first segment alone (`only-2`) | 1 | 0 | 3 |
| U1 second segment alone (`only-7`) | 1 | 0 | 3 |
| U1 connected segment pair (`pair-2-7`) | 2 | 1 thermal at U1.7 | 3 |
| U2 segment alone (`only-6`) | 1 | 1 thermal at U2.15 | 2 |
| All generated copper | 9 | 2 thermals | 0 |
| All generated copper except first U1 segment (`except-2`) | 8 | 1 thermal at U2.15 | 1 |
| All generated copper except U2 segment (`except-6`) | 8 | 1 thermal at U1.7 | 1 |

All three causal segments are 0.250 mm wide, on F.Cu and on
`Net-(LO(Q)1-Pad1)`. Native reports require two thermal spokes and find one.
The two-segment witness has the original route geometry:

- `3837e144-04ed-4677-a7ac-4e5609108771`: (81.764, 133.108) → (81.014, 130.108) mm.
- `debd372e-2f77-4d2d-aa40-6dd5243a7732`: (81.014, 130.108) → (80.264, 130.108) mm.
- U2's single segment is `d90d6c34-6e49-4507-a99e-bcd4d92a25b7`: (80.264, 113.608) → (76.073, 109.855) mm.

The default schedule checks original/all-added, all nine singletons and all
nine leave-one-out variants: 20 × 3 = 60 checks. The pair schedule checks
original/all-added and all 36 pairs: 38 × 3 = 114 checks. Across 174 checks,
there are 56 distinct subsets because both schedules retain baseline controls.
Every complete native error record and open count agrees across repeats.

**39 checks have native saved-design drift**, predominantly when disconnected
vias are reassigned to ground. Those outcomes are recorded but excluded from
admissible causal witnesses. The original, all-added, two U1 singleton controls,
U1 pair and U2 singleton retain their proposed saved design. Minimum cardinality
means the smallest *admissible tested addition subset to this intact input*,
not the smallest PCB or a general statement about all thermal failures. No
subset is accepted as a repair: removing route items can add opens, and even
the causal witnesses remain incomplete boards.

`verify.py` reconstructs each proposal from the original source and selected
routed nodes; binds labels to their exact subsets; checks original-node
retention, saved-design signatures, full native error records, opens, rule
sidecars and all repeat coverage. Replay checks retained evidence; it does not
rerun or authenticate native reports. `manifest.json` hashes the published
files. The default schedule was measured before the optional pair CLI schedule
was added; default schedule behavior is unchanged. An exploratory run stopped
on saved via-net drift; the retained runs explicitly record and exclude drift. The first complete pair sweep
reported shell status 143 after writing its results; a fresh sweep exited zero
and reproduced all 114 rows and proposed/saved board hashes exactly. Only the
fresh pair sweep is packaged.

The previously measured full router result remains **39/78 passing runs,
13/26 cases valid 3/3, 120 opens, 27 new thermal errors**. It is not rerun or
revised here. Engine sources/tests match main `69cf598`. Required typecheck,
layer checks (65 files, zero violations) and all 859 tests pass. The next
production work must retain required native thermal connections across a whole
route; independently validating each candidate copper item is insufficient
for the U1 witness. This evidence does not establish a particular guard design.

Reproduce with new output directories from the repository root:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c165-thermal-causes
P=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/qrpcard-auto-links/j2-small
mkdir -p /tmp/thermal-causes/input /tmp/thermal-causes/routed /tmp/thermal-causes/retained
gzip -dc "$R/input.kicad_pcb.gz" > /tmp/thermal-causes/input/input.kicad_pcb
cp "$R/input.kicad_pro" "$R/input.kicad_dru" /tmp/thermal-causes/input/
gzip -dc "$P/source.kicad_pcb.gz" > /tmp/thermal-causes/routed/source.kicad_pcb
cp "$P/source.kicad_pro" "$P/source.kicad_dru" /tmp/thermal-causes/routed/
for schedule in single-and-removal pairs; do
  taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/isolate.py" \
    --schedule "$schedule" --input /tmp/thermal-causes/input/input.kicad_pcb \
    --routed /tmp/thermal-causes/routed/source.kicad_pcb \
    --out "/tmp/thermal-causes/$schedule"
done
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$R/verify.py" \
  --input /tmp/thermal-causes/input/input.kicad_pcb \
  --results /tmp/thermal-causes/single-and-removal /tmp/thermal-causes/pairs \
  --out /tmp/thermal-causes/fresh-findings.json
# Replay the retained checks without rerunning native DRC:
tar -xzf "$R/native.tar.gz" -C /tmp/thermal-causes/retained
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$R/verify.py" \
  --input /tmp/thermal-causes/input/input.kicad_pcb \
  --results /tmp/thermal-causes/retained/single-and-removal /tmp/thermal-causes/retained/pairs \
  --out /tmp/thermal-causes/retained-findings.json
taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$R/render.py" \
  --singles /tmp/thermal-causes/retained/single-and-removal \
  --pairs /tmp/thermal-causes/retained/pairs --out /tmp/thermal-causes/render
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Every native subprocess has a 120-second timeout. All source/frozen/shared
runtime files remain unchanged. The image uses actual native F.Cu exports of
the retained, refilled boards; it does not reconstruct copper shapes.

![Native thermal causes](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c165-thermal-causes/comparison.png?raw=true)
