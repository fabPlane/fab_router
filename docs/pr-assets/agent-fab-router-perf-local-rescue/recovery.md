# Local exact-geometry recovery experiment, cycle 23

The ten-pad endpoint fixture has a legal full-width route for its last connection.
The original 60-pad context still stalls. This commit adds a route witness and a
regression, plus an explicitly invoked research runner. Public routing code and
settings remain byte-identical to main `69cf598` (91 production/type/tool files).
There is no adopted recovery, native completion gain, or performance improvement.

All comparisons below use the same input, seed 1, settings, machine
`hyper-ms-lin`, cores 12–19, and **three repeats per row**. Each runner first calls
the normal public pipeline, then attempts recovery on its final copper. Other
nets are ignored with duplicated groups preserving their physical rules; their
copper remains an obstacle. The original context keeps all 60 physical pads. Both contexts filter net pad
references to the retained-ID manifest; all active target terminals are retained,
and other nets are ignored. These altered diagnostic contexts are not full-board
scheduling controls. Every normal run leaves exactly one target-net connection, 10→62, open.

| Context / recovery proposal | Target opens before → after, sum of 3 | Complete before → after | Added exact violations | Normal median / p95 s | Extra recovery median / p95 s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ten pads: exact edges, retain raw path | 3 → 0 | 0/3 → 3/3 | 0 | 3.542 / 3.851 | .042 / .043 |
| Ten pads: exact edges, pull then shape each leg | 3 → 0 | 0/3 → 3/3 | 0 | 3.722 / 3.981 | .045 / .046 |
| Ten pads: node checks, retain raw path | 3 → 0 | 0/3 → 3/3 | 0 | 3.597 / 3.936 | .009 / .010 |
| Ten pads: node checks, pull then shape each leg | 3 → 0 | 0/3 → 3/3 | 0 | 4.202 / 4.522 | .009 / .010 |
| Original 60 pads: exact edges, retain raw path | 3 → 3 | 0/3 → 0/3 | 0 | 4.071 / 4.399 | 6.371 / 6.379 |

These are target-net engine results, **not native board pass counts**. p95 is the
maximum of three observations. Shared-host timings are descriptive; recovery
adds work. No new native check was run on the modified diagnostic contexts.
The full native verification of unchanged production is recorded separately in
`recovery/native-verification.json`.

The research runner tries endpoint bounding boxes inflated by four, then eight
original routing pitches. Within each box, it tries pitch divisors 2, 4, 8, 16,
both endpoint directions, and shared usable sheets. Each search has at most
60,000 raw heap pops and a 15-second deadline. It uses uniform search costs,
which differ from the normal preferred-direction costs. This is a local
proposal experiment, not an isolated A/B replacement of the production search.
Widths, spacings, via rules, rim and hole clearances remain unchanged. No vias,
necking, rip-up, shove, neighbour rerouting, or removal of safety margins occurs.

Every proposed edge is angle-shaped and checked with the current exact
`legaliseTrail` predicate before insertion. In `node-*` ablations edge checks
are deferred to the insertion stage. Final copper must have zero exact DRC
violations and rebuild to zero target connections. Otherwise the Journal is
rewound and the complete session must equal the pre-recovery session exactly.
Retained pads, tracks, barrels and pours are checked byte-for-byte. The original
context has 48 failed trials: 36 reach the pop cap and 12 exhaust their search;
all restore exactly, without deadline or cancellation events. This does not
prove physical impossibility or sufficient search budgets.

All four reduced-context variants produce the **same raw grid path**, 3,985 pops,
at the first rung (3750 LU, sheet 1). Thus exact edge checking is not necessary
for this successful proposal. The raw path passes the current whole-path
legaliser. Pulling it produces a three-point centreline which fails both current
whole-path shaping variants. Independently choosing a legal shape for each
pulled leg succeeds. Retaining the raw proposal is also sufficient. This is a
controlled observation about this proposal, not proof that pulling is the only
cause of the original pipeline or full-board failure.

Every reduced variant adds one track and no vias. Track width stays 250 µm;
total router track length is 2.540 → 39.830037 mm, identically across repeats.
The original context stays at 2.540 mm and adds no copper. Session hashes are
deterministic within every final row. `recovery-summary.json` includes all
per-repeat lengths; raw proposals, profiles and trials are retained alongside it.

The active regression uses `test/data/near-complete-endpoint-path.json` to check
that the raw witness can legally close the reduced fixture after the normal
pipeline. It verifies full width, zero exact DRC, all target terminals joined,
and exact session/connectivity restoration after rewind. It allows a future
router to close the fixture normally. It does not require preserving either
stall or shaping failure.

Four initial exploratory groups (12 runs total) are also retained:
`exact-local.json`, `ablated-pull.json`, `ablated-edge.json`, `final-node-pull.json`.
They have the same settings and outcomes, with earlier observation fields.
They are not additional native attempts or independent evidence for a gain.
The final comparison contains 15 new runs, including the negative original
context. No routing attempts were discarded. A targeted test initially ran
before its generated witness existed and failed at module import; generating
the witness corrected setup before the passing verification.

Reproduce from this checkout, with unused output paths:

```sh
assets=docs/pr-assets/agent-fab-router-perf-local-rescue
mkdir /tmp/recovery-new
for mode in exact-keep exact-pull node-keep node-pull; do
  taskset -c 12-19 nice -n 10 timeout 650 bun "$assets/exact-local-recovery.ts" \
    "/tmp/recovery-new/reduced-$mode.json" reduced "$mode"
done
taskset -c 12-19 nice -n 10 timeout 650 bun "$assets/exact-local-recovery.ts" \
  /tmp/recovery-new/original.json original exact-keep
bun "$assets/recovery-geometry.ts" /tmp/recovery-new/geometry.json
python3 "$assets/summarise-recovery.py" /tmp/recovery-new
python3 "$assets/plot-recovery.py" /tmp/recovery-new /tmp/recovery-new/routes.png
taskset -c 12-19 nice -n 10 timeout 120 bun test test/near-complete-endpoint.test.ts
taskset -c 12-19 nice -n 10 timeout 900 bash -c \
  'bun run typecheck && bun run check:layers && bun run test'
```

Plotting needs matplotlib. The image shows real pad geometry and schematic
route centrelines, not a copper-width render. Full native verification:

```sh
cd /home/hyper/bench/wt/fp-perf
taskset -c 12-19 nice -n 10 timeout 1800 python3 benchmarks/autorouter/benchmark.py \
  --router fab-router --fab-router-source /home/hyper/bench/wt/fr-perf \
  --out /tmp/recovery-native-new
```

The default-off public recovery setting and general post-pass integration remain
unfinished. The original-context negative result rejects adopting this proposal
as a board recovery. Dense, ladder L2/L3, and slow-acceptance candidate gates
remain required before any future production recovery is promoted; this
research-only change has no candidate claim for those inputs. No pin bump.

Final native result: 39/78 passed, 13/26 valid on all repeats, 120 opens,
27 existing thermal errors, identical to the historical control. All 78 sessions,
quality outcomes, via counts and lengths match. Historical → current attempt
median 1.230 → 1.118 s, p95 16.772 → 20.078 s, total 396.295 → 372.761 s;
shared-host variation and removed observation code, not a speedup claim.
See `recovery/native-tables.md` for all per-case results. The comparator verifies
input/settings/session hashes, manifest, runtime, checker, source hashes, order,
cores and step exit/timeout status. No native DRC improvement is claimed.
