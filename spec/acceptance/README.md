# Acceptance

One generic runner (`test/acceptance.test.ts` for the fast tier under `bun run test`;
`tools/acceptance/run.ts` for any tier with a JSON report) executes every case under `cases/`.

## Case envelope (`schema/case.schema.json`)

```json
{
  "id": "routing-fast-<board>-<what>",
  "kind": "routing",
  "origin": "refA-suite | refB-suite | both | new",
  "tier": "fast | slow",
  "board": "<file under boards/>",
  "settings": { "...": "spec/api/settings.md names; plus timeoutSeconds, fanoutMaxPasses, fanoutMaxItems, optimizerMaxPasses, optimizerMaxItems" },
  "rules": "<optional .rules file under boards/ applied before routing>",
  "expect": { "<metric>": { "exact|max|min|maxAdded|maxRatioToReference|preExisting": number, "advisory": false } },
  "reference": "<optional reference/ file name to resolve maxRatioToReference against>",
  "note": "free text"
}
```

Kinds and what `expect` may name:

| kind | runs | metrics |
|---|---|---|
| `parse` | `readDsn` | `status` (`ok`/`error`), `summaryEquals` (path under `parse/`), item counts from the summary |
| `ses-roundtrip` | `readDsn` → `writeSes` → normalise → compare with `ses/<board>.unrouted.sexp.json` | `treeEquals` |
| `ses-apply` | `readDsn` → `applySes(reference .ses)` → `checkDrc` / `layoutStats` | `incomplete`, `barrels`, `violations`, `tracks` |
| `rules` | `readDsn` → `readRules` → `applyRules` | `accepted`, effective values by name |
| `drc-load` | `readDsn` → `checkDrc` | `violations`, `incomplete` |
| `settings` | `readDsn` (+ rules) → `route` with `routerEnabled:false` | fields of `report.effectiveSettings` |
| `routing` | `readDsn` (+ rules) → stats → `route` → stats | `incomplete`, `violations` (`maxAdded`), `passes`, `barrels`, `traceLengthMm`, `addedTracks`, `addedBarrels`, `wallClockMs`, `stoppedBy` |
| `srj` | `routeSrj` | `incomplete`, `violations`, per-pair `skewMm` |

Expectation operators: `exact`, `max`, `min` compare the measured number; `maxAdded` compares
(after − before) for violations; `maxRatioToReference` compares measured / reference value from
the `reference/` file for the case's settings profile; `preExisting` asserts the before-value.
`advisory: true` records a mismatch in the report without failing the case (used for wall clock).

## Tiers

`fast` cases finish in under ~10 s each on the reference hardware and run in `bun run test`.
`slow` cases run only via `bun run acceptance -- --tier slow`. `MANIFEST.json` gives each board a
default tier; a case may override it.

## Reports

`tools/acceptance/run.ts --report <file>` writes `{ taken, head, cases: [{ id, pass, measured,
expected, advisoryMismatches }], summary: { passed, failed, advisory } }`. Runs also write a
one-line-per-board CSV to `spec/acceptance/out/` (git-ignored).

## Reference profiles (`reference/<board>.<profile>.json`, `schema/reference.schema.json`)

| profile | settings |
|---|---|
| `default` | maxPasses 100, timeoutSeconds 60, optimizer on, fanout off |
| `p1` | maxPasses 1 |
| `fanout` | fanoutEnabled true, then default |
| `strict` | strictDrc true |
| `novia` | viasAllowed false |

Each file records, for reference A and reference B separately: `connections`, `incompleteBefore`,
`incompleteAfter`, `vias`, `traceLengthMm`, `violationsBefore`, `violationsAfter`, `passes`,
`wallClockMs` (advisory), and a `notes` field for any disagreement and the spec's ruling.
`maxRatioToReference` resolves against reference B unless the case names `referenceSide: "A"`.
