# Bounded automatic thermal search on the complete Aquarius output

This static experiment starts from the untouched, native-refilled Aquarius J4
output of the complete cycle-133 frozen engine run. Earlier Aquarius searches
used reduced or partly repaired inputs. The input SHA256 matches the original
native checker record in `provenance.json`. No source design or rule is changed.

The existing metadata-driven search discovers thermal pad UUIDs from native
findings and tests additive straight/bent same-net links. Each acceptance requires
a strict subset of the previous errors, identical terminal inventory, no lost
connected pairs, no increased opens, exact saved-design identity and unchanged
rule sidecars. Every rejection retains the current bytes. A lower error count
alone is insufficient. The candidate budget is 128 per repeat.

These are offline diagnostics, outside the router benchmark. Engine and adapter
code are unchanged. Selected boards are not substituted into benchmark results;
live adapter refill/undo ownership remains unresolved.

Same host, source board and rules, native 10.0.6, cores 20–25, three
independent repeats:

| Static native measurement, each repeat | Input | Selected |
|---|---:|---:|
| Error count | 6 | 0 |
| Opens | 15 | 15 |
| Lost connected terminal pairs | — | 0 |

Each search checks 93 proposals plus its baseline: 282 fresh native checks in
all. Five accepted links append six 0.127 mm B.Cu segments. The accepted schedule
is C1.2 (trial 6), U1.53 (9), U1.39 (14), U1.48 (90, bent link also removes the
U1.46 thermal), then R20.1 (92). Every original design node remains unchanged.
All selected board bytes match across repeats, SHA256
`4cd120ea0ef6190e122202f9b7b40aeb5a2fa60b98042c6c54cc072589bf1de1`.
Search stops with no thermal targets, below its candidate budget.

Each repeat includes one saved-design identity rejection (`ValueError`), trial
10. Its saved report appears to have three errors and 14 opens, but native save
changes existing track `828c4f30-8546-4893-a313-daf2d734006c` from
`Net-(C1-Pad1)` to `GNDD`. That report describes a different design and cannot
authorize the proposed bytes. The guard rejects it before terminal comparison.
The earlier provisional 14-open count is therefore not a selected improvement.
`inspect-identity.py` reconstructs the rejected proposal and verifies its hash
before identifying the exact changed node. The other 87 rejected proposals per
repeat fail the strict error-subset guard; none are silently omitted.

The archive retains 1,420 files. `pack.py` stores 662 distinct contents and
represents duplicate bytes with archive hardlinks, reducing the archive from
134 MiB to 48 MiB without dropping evidence. All 1,420 extracted hashes match
the raw files. The full raw schedule replay passes all 282 checks, including
the saved-design rejection and every acceptance/rollback decision. The original native rule file's final blank line is intentionally
preserved byte-for-byte.

Engine typecheck and layer checks pass; all 859 tests pass with zero failures.
The thirteen existing search controls pass. No router benchmark is run here;
the unchanged latest full reference is still 39/78 passing attempts, 13/26 valid
cases, 120 opens and 27 added thermal errors. This does not establish a live
transaction fix or a production routing gain.

![Accepted static stages](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-full-auto-links/comparison.png?raw=true)

Reproduce from the repository root, using new output directories:

```sh
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-full-auto-links
mkdir -p /tmp/aquarius-full/source /tmp/aquarius-full/retained
gzip -dc "$R/source.kicad_pcb.gz" > /tmp/aquarius-full/source/source.kicad_pcb
cp "$R/source.kicad_pro" "$R/source.kicad_dru" /tmp/aquarius-full/source/
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 -B "$A/auto-links.py" \
  --source /tmp/aquarius-full/source/source.kicad_pcb \
  --out /tmp/aquarius-full/fresh --budget 128
tar -xzf "$R/native.tar.gz" -C /tmp/aquarius-full/retained
taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$A/verify-auto-links.py" \
  --source /tmp/aquarius-full/source/source.kicad_pcb \
  --results /tmp/aquarius-full/retained
python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/qrpcard-auto-links/summarize.py \
  /tmp/aquarius-full/retained /tmp/aquarius-full/comparison.json
cmp "$R/comparison.json" /tmp/aquarius-full/comparison.json
python3 "$R/analyze.py" /tmp/aquarius-full/retained /tmp/aquarius-full/stages.json
cmp "$R/stages.json" /tmp/aquarius-full/stages.json
/usr/bin/python3 -B "$R/inspect-identity.py" /tmp/aquarius-full/source/source.kicad_pcb \
  /tmp/aquarius-full/retained /tmp/aquarius-full/identity-rejection.json
cmp "$R/identity-rejection.json" /tmp/aquarius-full/identity-rejection.json
taskset -c 20-25 nice -n 10 timeout 60 /usr/bin/python3 -B "$A/auto-link-controls.py"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
python3 "$R/chart.py"
rsvg-convert -w 1600 "$R/comparison.svg" -o "$R/comparison.png"
```

The native checker has a 120-second subprocess timeout. Replay verifies saved
evidence without executing DRC or authenticating native reports; it shares the
proposal/search implementation. `archive-sha256.json` covers all retained files,
verified against raw output after an archive round trip. `code-sha256.json`
identifies the diagnostic code.

## Report correction and regression controls

The report previously compared rejected proposals' open counts against the
original input, while search acceptance compares against the latest accepted
board. If an accepted repair reduces opens from two to one, a later proposal
with two opens is rejected by search but its summary omitted that blocker.
The reporter now advances its open-count reference after each acceptance.
Search acceptance and all native safety guards are unchanged.

A synthetic regression was added first. Identical three controls on the same
host and cores, three repeats per reporter: pinned `e0e2058` passes 2/3;
fixed reporter passes 3/3. The controls also cover counts above the original
baseline and counts equal to the current accepted board. They do not run DRC.
The two previous complete-board native summaries remain byte-identical.
This is a prospective reporting defect demonstrated by the synthetic control;
the native search is not claimed to reproduce it.

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-full-auto-links
taskset -c 20-25 nice -n 10 timeout 180 python3 -B "$R/compare-controls.py" \
  /tmp/aquarius-report-controls
```
