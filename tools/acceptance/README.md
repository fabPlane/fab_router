# `tools/acceptance` — the acceptance runner

Runs every declarative case under `spec/acceptance/cases/` against the public API in `src/api.ts`
(`spec/acceptance/README.md` is the contract).

```
bun run acceptance -- --tier <fast|slow|all> [--case <glob>] [--report <file>] [--quiet]
FAB_ROUTER_ACCEPT_STUBS=1 bun run acceptance -- --tier all --report /dev/stdout
```

| File | Role |
|---|---|
| `schema.ts` | dependency-free JSON-Schema subset validator (`type`, `required`, `properties`, `additionalProperties`, `enum`, `pattern`, `minimum`, `items`, `$ref`), `deepEqual`, `firstDifference` |
| `cases.ts` | loads and validates cases, resolves `boards/`, `reference/` and `equalsFile` resources, maps case settings (`router`, `optimizer`, `fanout`, `timeoutSeconds`, `optimizerMaxPasses`) to `RouteSettings`, glob matching |
| `sexp.ts` | self-contained DSN lexer (dsn.md F-1 … F-13) and the session canonicalisation of ses.md F-S50 |
| `run-case.ts` | executes one case by kind, measures the metrics of the README table, evaluates `exact / max / min / maxAdded / maxRatioToReference / preExisting / equalsFile` with `advisory` |
| `run.ts` | CLI, JSON report `{ taken, head, cases[], summary }`, one CSV per run under `spec/acceptance/out/` (git-ignored) |

`test/acceptance.test.ts` runs the `fast` tier as one `test()` per case under `bun run test`.

## Outcomes

`pass`, `fail`, or `stub`. A case is a `stub` when the API answered with the `not-implemented`
diagnostic (`src/pipeline`) or when a resource the case needs (board, rules, session, reference,
expected file) is not in the checkout. Stubs **fail** unless `FAB_ROUTER_ACCEPT_STUBS=1` is set,
in which case they are reported as passing with `stub: true` and counted under `summary.stubbed`.
Nothing is ever skipped.

## Measured metrics per kind

| kind | measured keys |
|---|---|
| `parse` | `status`, `layers`, `components`, `pads`, `nets`, `padstacks`, `tracks`, `vias`, `pours`, `fences` (from the Layout), `summaryEquals` (from `src/dsn` `parseSummary`) |
| `ses-roundtrip` | `treeEquals` (canonical tree of `writeSes` output) |
| `ses-apply` | `incomplete`, `barrels` / `vias`, `violations`, `tracks`, `appliedTracks`, `appliedBarrels` |
| `rules` | `accepted`, `angleMode`, `defaultWidthUm`, `pinEdgeToTurnUm`, `spacingUm:<A>:<B>` (Sheet 0, pair type `default`), `groupWidthUm:<G>` |
| `drc-load` | `violations`, `incomplete` (case settings `copperToEdgeClearanceUm`, `holeClearanceUm`, `ignoreNetGroups` become `DrcOptions`) |
| `settings` | every metric is a `/`-separated path into `report.effectiveSettings` |
| `routing` | `incomplete`, `violations` (+ `...Before` for `maxAdded` / `preExisting`), `passes`, `barrels` / `vias`, `traceLengthMm`, `addedTracks`, `addedBarrels`, `wallClockMs`, `stoppedBy`; invariants R-3 and R-5 are checked on every routing case |
| `srj` | `ok`, `incomplete`, `violations`, `passes`, `wallClockMs`, `skewMm:<p>:<n>` |

`maxRatioToReference` reads `reference/<file>` (`refB` unless `referenceSide: "A"`) and maps
`incomplete → incompleteAfter`, `violations → violationsAfter`, `barrels`/`vias → vias`.
