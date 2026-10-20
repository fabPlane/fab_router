# Native DRC acceptance gate

The text router checks imported copper geometry. Its report does not include the native
zone-refill thermal-spoke checks. A route that reports no added geometric violations can
introduce a native thermal violation after application and refill.

Use this optional command before accepting an already applied candidate board:

```bash
bun tools/native-drc-gate.ts original.kicad_pcb candidate.kicad_pcb native-report.json
```

Each board must have a same-stem `.kicad_pro`; same-stem `.kicad_dru` files are optional.
Both sets of project rules must be byte-identical. Install `kicad-cli` and `python3` with matching native `pcbnew` bindings on PATH. The command
copies boards and rules to a temporary directory and runs the following for each copy:

```bash
kicad-cli pcb drc --severity-all --format json --units mm --refill-zones --save-board --output report.json board.kicad_pcb
```

Exit codes are **0** for acceptance, **1** for rejection, and **2** for an operational error.
All outcomes other than 0 must block acceptance. Each native process has a 120-second timeout.
The optional report file is created exclusively and must not exist already. Without it,
JSON goes to stdout. A report includes both full native reports and hashes of the exact
board bytes that were checked. Source boards and rule files are never passed to the native
process or overwritten. Temporary files are removed on success and failure.

Acceptance requires no new error-level native findings, no increase in native opens,
and preservation of every previously connected source-terminal pair.
Errors are compared as a multiset of type, severity, physical item descriptions and positions;
imported UUID changes do not turn inherited errors into new errors. A removed error cannot
mask a different new error. Native versions, included severities and ignored-check policies
must match; error checks must be enabled. Connectivity entries must be error-level
`unconnected_items` findings with at least two described endpoints and finite millimetre
coordinates. Malformed entries fail closed before either open total is used.

After DRC saves each refilled disposable board, `tools/native-terminal-groups.py`
loads those copies and builds native connectivity. It compares pad groups using net,
footprint reference/position, pad number/position and pad layers, independently of
regenerated UUIDs. Previously separate groups may join; previously connected pairs
must remain connected. Equal or decreasing open counts alone cannot prove this.
Ambiguous identities, changed inventories, non-equivalence native queries, mismatched
binding versions and helper failures block acceptance. Results retain both partitions,
the exact number of lost pairs and up to 32 witness pairs. No source path is saved.
Each DRC process and the connectivity helper has its own 120-second timeout.

Before native checking, both boards must retain the same embedded `setup` tree and
physical layer table (IDs, canonical names, types and order). This includes stackup,
solder-mask settings and unknown future setup fields. Whitespace and numeric formatting
are normalized; optional layer display aliases are ignored because native save may add
them. Setup child order and plot settings are compared conservatively, so unrelated setup
edits may also block acceptance. Malformed boards or duplicate/missing sections fail closed.

The complete board-level net ID-to-name table must match, regardless of table order.
Routing may not rename, exchange, add or remove electrical nets. Numeric copper net
fields alone cannot establish preserved electrical ownership. Duplicate IDs/names or
malformed net declarations fail closed. Renumbering nets conservatively blocks acceptance.

Original board-level segments, arcs and vias must also remain present as a multiset,
including geometry, width, net and other physical fields. Additional routing items
are allowed. Named field order and numeric formatting are normalized. Equivalent
track splitting or deliberate edits to original copper conservatively block acceptance.

Authored board-level zone definitions must match as a multiset, including thermal gaps,
spoke widths, clearances, connection modes, polygons, ownership, keepouts and unknown
fields. Top-level named field order and numeric formatting are normalized. Generated
UUIDs and derived `filled_polygon`/`filled_segments` caches may change during refill.
Nested rule and polygon vertex order are compared conservatively. Adding, deleting or
editing a zone blocks acceptance before native checking.

Source footprint pads must match as a multiset, including local geometry, pad number,
type, shape, layers, net, drill, custom primitives and local rules. Their footprint
position, rotation, side and clearance/mask/paste/thermal overrides must also match.
Regenerated pad UUIDs, numeric formatting and named-field ordering are permitted.
Even sub-micrometre footprint-position rounding blocks acceptance; the gate does not
silently treat changed terminal geometry as equivalent. Other footprint metadata and
external library dependencies are outside this check.

This is a DRC/connectivity gate, not a complete design-fidelity validator or a repair command. It does
not require zero opens, remove inherited violations, verify all other metadata,
or apply/undo anything in an editor. The host must separately verify design fidelity,
per-item rules, external dependencies and the exact checked bytes before committing a
candidate. No live-editor transaction or benchmark scoring path calls this optional command
automatically. In particular, rejecting an unsafe candidate does not improve the routing
benchmark's completion score or fix its thermal geometry.

## Publish a checked candidate snapshot

For an offline artifact that retains the exact checked board and rule bytes, use:

```bash
bun tools/native-candidate-bundle.ts original.kicad_pcb candidate.kicad_pcb accepted.json
```

The output must not exist. Exit codes have the same meanings as the read-only gate.
A rejected candidate or a checker failure creates no bundle. Acceptance creates a
`fab-router-native-candidate-v1` JSON bundle containing both full native reports,
board hashes, and `input` / `candidate` file arrays. Each file has a fixed `name`,
a SHA-256 digest, and its exact bytes in `base64`. An absent optional custom-rule
file is omitted. The publication uses the in-memory snapshots that were checked,
even if the caller's paths change while native validation runs. It does not reread
those mutable paths after acceptance.

The complete bundle is staged on the output filesystem, then published with an
exclusive hard link. Readers see the complete artifact; existing files and symlinks
are never replaced. Output paths overlapping either board or its rule sidecars,
including absent sidecars reached through directory symlinks, are rejected. Staging
files are removed on normal success and failure. An interrupted process can leave
an unpublished staging directory; this is not a power-loss durability guarantee.

Inspect the reports and verify all decoded hashes before using a bundle. For example,
extract the candidate into a fresh directory (the input can be extracted similarly):

```bash
python3 - accepted.json extracted-candidate <<'PY'
import base64, hashlib, json, pathlib, sys
bundle = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert bundle['format'] == 'fab-router-native-candidate-v1'
assert bundle['validation']['accepted']
files = bundle['candidate']
assert {f['name'] for f in files} in (
    {'board.kicad_pcb', 'board.kicad_pro'},
    {'board.kicad_pcb', 'board.kicad_pro', 'board.kicad_dru'},
)
assert len(files) == len({f['name'] for f in files})
decoded = [(f, base64.b64decode(f['base64'], validate=True)) for f in files]
for f, data in decoded:
    assert hashlib.sha256(data).hexdigest() == f['sha256']
assert next(f['sha256'] for f in files if f['name'] == 'board.kicad_pcb') == bundle['validation']['candidateSha256']
output = pathlib.Path(sys.argv[2]); output.mkdir(exist_ok=False)
for f, data in decoded:
    (output / f['name']).write_bytes(data)
PY
```

The bundle is a local interchange artifact, not a signed attestation. Publication uses
all existing gate checks and limitations: acceptance may retain inherited errors and
opens, and does not prove complete design fidelity or protect every item of authored metadata. It neither edits the source paths nor commits a transaction to a live editor.
The benchmark and editor do not invoke it automatically. A host integrating it must
still bind the intended input to the recorded hash and handle its own atomic application
and undo. It does not discover or repair thermal geometry.

## Proposed repair handoff

A thermal repair must preserve connections achieved by routing as well as authored
source connections. Comparing only to the original board can accept a repair that
swaps one routed terminal for another with the same open count. To check an existing
proposal and publish its exact snapshots:

```bash
bun tools/native-repair-bundle.ts original.kicad_pcb routed.kicad_pcb repaired.kicad_pcb accepted-repair.json
```

The source fidelity checks apply independently to routed and repaired boards. The
repaired board must pass the original acceptance boundary and introduce no new errors,
additional opens or lost connected terminal pairs relative to the routed board. Copper
added during routing may be replaced during repair; original copper stays protected.
All three rule sidecars must match. Each native process retains its own timeout.

An accepted `fab-router-native-repair-v1` bundle contains `input`, `routed` and
`candidate` snapshots. Its `validation.repair` records the routed native report,
board hash, before/after open counts and terminal groups. `candidate` is the repaired
board. Publication uses the same exclusive atomic file creation as candidate bundles;
the output cannot overlap any of the three source boards or rule sidecars. Rejection
publishes nothing. The exported `checkNativeRepair` checks without publication, and
`publishNativeRepair` performs this handoff.

This command checks a supplied proposal. It does not generate detours, invoke the
bounded search, update the engine or apply a board to an editor. An unchanged routed
board may pass; acceptance is a safety check rather than proof of repair progress.

## Opt-in bounded thermal search

```bash
timeout 2400 bun tools/native-thermal-search.ts original.kicad_pcb routed.kicad_pcb accepted.json new-search-directory
```

This offline command connects generated-track proposals to the three-board repair
boundary. It freezes the source and routed boards with their rules in an exclusively
created search directory. It ranks at most eight generated segments near native
thermal pad markers and tries the existing six single-segment detours, followed by
at most sixteen connected segment pairs with sixteen corner displacements each.
Authored copper is excluded by both source UUID and exact physical segment inventory,
so native import can regenerate UUIDs without making retained tracks eligible. Segment
matching ignores endpoint direction and numeric formatting, while preserving width,
layer and net. All physical matches are excluded, including duplicate instances;
source copper remains independently protected by the strict native gate. This is at
most 304 proposals per stage and eight stages. Use an
outer wall-clock timeout as shown; each native process also has a 120-second timeout.

An intermediate stage must strictly reduce both total native errors and errors
introduced relative to the source. Remaining introduced errors must be thermal
errors. The candidate must introduce no finding relative to the current stage,
increase neither source nor current open counts, and preserve every connected
terminal pair in both the source and current stage. Discovery refreshes after each
accepted stage. Every checked proposal and full validation is retained in the search
directory; checker/generator exceptions stop the search and publish nothing.

Publication requires a final check against the original routed snapshot and the
source, with zero introduced errors. The exact three-board bundle is then published
exclusively. Exhaustion or incomplete progress publishes nothing, and caller boards
are never changed. An already acceptable routed board can publish unchanged with
`repaired: false`. A failed search can retain intermediate progress in its diagnostic
work directory; those boards are not accepted output.

The text routing API, benchmark adapter and editor do not invoke this command. It
provides no automatic application or undo. Search outcomes on retained complete
boards are offline native experiments, not scored benchmark routing outcomes.

## Native load/save copper ownership

The gate compares each submitted board's track, arc and via inventory with its
native-saved, refilled counterpart. Numeric net codes resolve through that board's
legacy net table; current quoted net names compare directly. Missing net fields
represent unassigned copper. Ownership, item multiplicity and physical fields
(endpoints, arc midpoint, position, width, size, drill and layers) must match.
UUIDs and native-added manufacturing/display defaults are outside this comparison;
it is not a complete native-save fidelity proof. Unknown numeric net codes and
ambiguous net fields fail closed.

`nativeCopperChecks` records input, candidate and optional routed comparisons in
that order; `nativeCopperPreserved` is their conjunction. A mismatch rejects
acceptance, intermediate thermal progress and bundle publication even when DRC
reports are clean and all terminal pairs survive. This catches load-time track
net reassignment that report and terminal comparisons alone cannot detect. Caller
files remain unchanged.

The reduced axial Aquarius diagnostic previously published by the report-only
boundary is unsafe: its three detour tracks change from the C1 net to the R1 net
during native loading. Zero thermal errors, the source open budget and preserved
terminal pairs do not make that detour legal. The ownership guard rejects it;
the bounded axial regression now requires no progress and no publication.
