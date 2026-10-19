# Preserve copper ownership in offline thermal repair candidates

The connected-via helper used coordinate equality alone to choose incident tracks.
A foreign-net track with an endpoint at the same coordinate was moved too. The
helper also accepted moves of original input vias and attached original tracks.
Native clearance and connectivity validation do not authorize modifying that
protected design. Five regressions fail against the old implementation, including
an exact unexpected foreign-track coordinate change, and pass with the fix.

Via displacement now requires an explicit original-copper UUID inventory, moves
only incident tracks on the via's declared net, and rejects a protected via or
protected same-net incident track. Missing net declarations reject the move.
The supplied tree remains unchanged on success and rejection. Both diagnostic
callers derive the inventory from the original input board. The old helper is
retained byte-for-byte as `geometry-before.py` solely for controlled comparison.
The inherited test now supplies valid net metadata and the required inventory.

Fresh controlled native comparison: same complete Aquarius output, rules, machine
`hyper-ms-lin`, cores 20–25, native 10.0.6, three full sequential repair repeats for
each helper. These are native refills, not new router seeds:

| Configuration | Input errors / opens | Selected errors / opens | Repeats |
| --- | ---: | ---: | ---: |
| Previous coordinate-only helper | 6 / 15 | 0 / 14 | 3 |
| Net-aware helper with protected-copper guard | 6 / 15 | 0 / 14 | 3 |

All six candidate stages and final selected bytes are identical before/after,
including terminal partitions and error findings. The independent verifier checks
all 42 saved native boards, rule sidecars, exact proposed/saved identity,
error-subset acceptance, no lost terminal pairs, and exact preservation of all
original-ID source nodes. Engine typecheck and layer checks pass; all 859 tests pass (398454 assertions,
224.54 seconds). The retained checks total 126 errors and 624 opens
across controls/intermediates, with 36 accepted intermediate stages and six clean
final boards; these aggregates are diagnostic counts, not benchmark scores.

This fixes an offline proposal-generation bug. The production engine and adapter
remain unchanged; the native 26-case × 3-seed score was not rerun and remains
39/78 passes, 13/26 valid cases, 120 opens and 27 added thermal errors. Fourteen
opens remain on the selected Aquarius board. Production native-aware recovery
and editor integration remain unimplemented. No pin bump is justified.

The archived source hashes bind this measurement. Earlier c181/c182 manifests
refresh the changed files; their historical native evidence and
measurement-time source hashes remain intact.
Provenance/license: [source](../c176-aquarius-search/README.md),
[input license](../aquarius-reduced/LICENSE).

Reproduce from the repository root with fresh directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/via-ownership
tar -xJf "$R/c183-via-ownership/native.tar.xz" -C /tmp/via-ownership
# Expected failure: five ownership regressions against the archived old helper.
/usr/bin/python3 -B "$R/c183-via-ownership/test_ownership.py" --helper "$R/c183-via-ownership/geometry-before.py"
/usr/bin/python3 -B "$R/c183-via-ownership/test_ownership.py"
/usr/bin/python3 -B "$R/c181-via-displacement/test_geometry.py"
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c183-via-ownership/verify.py" --root /tmp/via-ownership/evidence
# Remove only derived outputs in this disposable extracted copy before fresh runs.
rm -r /tmp/via-ownership/evidence/before/composed /tmp/via-ownership/evidence/after/composed
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c183-via-ownership/measure.py" --root /tmp/via-ownership/evidence/before --helper "$R/c183-via-ownership/geometry-before.py"
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c183-via-ownership/measure.py" --root /tmp/via-ownership/evidence/after --helper "$R/c181-via-displacement/geometry.py"
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c183-via-ownership/verify.py" --root /tmp/via-ownership/evidence
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native repair preserved with ownership guards](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c183-via-ownership/comparison.png?raw=true)
