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

This is a DRC/connectivity gate, not a design-fidelity validator or a repair command. It does
not require zero opens, remove inherited violations, verify preserved source copper/metadata,
or apply/undo anything in an editor. The host must separately verify design fidelity,
embedded board rules, external dependencies and the exact checked bytes before committing a
candidate. No live-editor transaction or benchmark scoring path calls this optional command
automatically. In particular, rejecting an unsafe candidate does not improve the routing
benchmark's completion score or fix its thermal geometry.
