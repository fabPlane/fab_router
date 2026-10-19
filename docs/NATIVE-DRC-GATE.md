# Native DRC acceptance gate

The text router checks imported copper geometry. Its report does not include the native
zone-refill thermal-spoke checks. A route that reports no added geometric violations can
introduce a native thermal violation after application and refill.

Use this optional command before accepting an already applied candidate board:

```bash
bun tools/native-drc-gate.ts original.kicad_pcb candidate.kicad_pcb native-report.json
```

Each board must have a same-stem `.kicad_pro`; same-stem `.kicad_dru` files are optional.
Both sets of project rules must be byte-identical. Install `kicad-cli` on PATH. The command
copies boards and rules to a temporary directory and runs the following for each copy:

```bash
kicad-cli pcb drc --severity-all --format json --units mm --refill-zones --output report.json board.kicad_pcb
```

Exit codes are **0** for acceptance, **1** for rejection, and **2** for an operational error.
All outcomes other than 0 must block acceptance. Each native process has a 120-second timeout.
The optional report file is created exclusively and must not exist already. Without it,
JSON goes to stdout. A report includes both full native reports and hashes of the exact
board bytes that were checked. Source boards and rule files are never passed to the native
process or overwritten. Temporary files are removed on success and failure.

Acceptance requires no new error-level native findings and no increase in native opens.
Errors are compared as a multiset of type, severity, physical item descriptions and positions;
imported UUID changes do not turn inherited errors into new errors. A removed error cannot
mask a different new error. Native versions, included severities and ignored-check policies
must match; error checks must be enabled. Connectivity entries must be error-level
`unconnected_items` findings with at least two described endpoints and finite millimetre
coordinates. Malformed entries fail closed before either open total is used.

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

This is a DRC/connectivity gate, not a complete design-fidelity validator or a repair command. It does
not require zero opens, remove inherited violations, verify preserved pads/other metadata,
or apply/undo anything in an editor. The host must separately verify design fidelity,
per-item rules, external dependencies and the exact checked bytes before committing a
candidate. No live-editor transaction or benchmark scoring path calls this optional command
automatically. In particular, rejecting an unsafe candidate does not improve the routing
benchmark's completion score or fix its thermal geometry.
