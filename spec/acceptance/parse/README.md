# Parse summaries

One file per board in `acceptance/boards/`, named `<board file name>.json`. Each is the
*normalised parse summary* of the board: what `readDsn` must make of the file, reduced to plain
names and counts so that two independent readers can be compared. The `parse-summary-*` cases
compare `readDsn`'s summary against these files with `summaryEquals` (deep equality of every
field except `_generated` and `notes`).

Every file here was produced by running both reference implementations' readers on the board
and reconciling the two observations; the `notes` array records each field on which they
disagreed and the ruling that decided the recorded value (rulings are numbered `D-S2-nn` in
`spec/formats/dsn-dialects.md`, section "From S2").

## How to compute the summary from a Layout

All lengths are in the **file's coordinate unit** (`unit`), as decimal numbers rounded to six
decimals, never in LU. A value that went through LU rounding (spacing, width) is reported after
that rounding, converted back to file units — see `spec/rules/clearance.md` C-04 for the exact
rule; e.g. `(clearance 200.1)` in a `(resolution um 10)` file is reported as `200.2`.

| Field | Meaning |
|---|---|
| `board` | The board file name under `acceptance/boards/` |
| `status` | `ok`, `outline-missing` (no usable `boundary`) or `parse-error` (no `pcb` scope recoverable). Only `ok` summaries carry the fields below |
| `resolution.unit`, `resolution.perUnit` | The `resolution` scope: unit name and subdivisions per unit |
| `unit` | The file coordinate unit. Equal to `resolution.unit` on every board in the corpus (the `unit` scope, when present, always agrees with it) |
| `angleMode` | `"45"` unless the file's `snap_angle` says otherwise (`"90"` for `ninety_degree`, `"any"` for `none`) |
| `layers[]` | The Stack in file order: `name`, `kind` (`signal` or `plane` — `plane` iff the layer's `type` is `power`), `index` (0-based position) |
| `nets[]` | Every net that exists after reading, sorted by `name` (UTF-16 code-unit order), then `subnet`. `pins` is the number of Pads on the net. `subnet` is present only when the file split the net (`fromto` / `order`; no corpus board does). `plane: true` marks a plane net (`spec/rules/layers.md` L-06). `group` is the NetGroup name when it is not the default group (a class named `default` or `kicad_default` *is* the default group, `spec/rules/nets.md` N-05). Nets created for a plane or power layer without a `net` scope are included |
| `components[]` | Every placed Part, sorted by `ref`: `ref`, `package` (the image name exactly as the `component` scope writes it, including any `::n` suffix), `side` (`front`/`back`); `placed: false` only for a Part the file declares without a location (none in the corpus) |
| `padstacks[]` | The names of all PadForms defined by the library, sorted (code-unit order), after padstack name normalisation (definitions whose normalised names coincide count once) (`spec/formats/padstack-names.md`) |
| `viaPadstacks[]` | The PadForms usable for Barrels, in first-mention order, without repeats: the structure `via` list, then every NetGroup's `use_via` names, then any padstack named by a network `via` definition that is not yet listed |
| `counts` | `pads` (Pads), `tracks` (Tracks from `wire` paths in `wiring`), `vias` (Barrels from `wiring`), `pours` (Pours: `plane` scopes, `wire` polygons, plus one board-covering Pour per power layer that names a net but has no Pour), `fences` (Fence items after instantiation: one per Sheet for a Fence that applies to every signal Sheet, one per Part pin-side for Part-owned keepouts) |
| `rules.defaultWidth` | Track width of the default NetGroup on Sheet 0 |
| `rules.defaultClearance` | Required spacing of Kind `default` against itself on Sheet 0 |
| `rules.smdToTurnGap` | The `smd_to_turn_gap` clearance if the file gives one, else the smallest default half-width (`spec/rules/clearance.md` C-12) |
| `rules.kinds[]` | Kind names in creation order; index 0 is always `null` (no clearance) and index 1 `default` |
| `rules.spacing` | For every unordered pair of Kinds with index ≥ 1, key `"<a>|<b>"` with a ≤ b in index order: the required spacing on Sheet 0 |
| `rules.layerDependent[]` | The pair keys whose spacing differs on some other Sheet (none in the corpus) |
| `rules.netGroups[]` | Every NetGroup in creation order (index 0 is `default`): `name`, `nets` (nets in the group), `width` (Sheet 0), `kind` (the Kind its Tracks carry), `viaRule` (name or null), and only when non-default: `widthBySheet[]`, `inactiveSheets[]` (Sheets this group may not route on — plane Sheets always, plus Sheets omitted from a `use_layer` list), `ignored: true`, `minLength`/`maxLength` (from `circuit`), `shoveFixed: true`, `pullTight: false`, `itemKinds` (the Kind each item category of this group carries when it is not `default`: keys `track`, `barrel`, `pin`, `smd`, `area`) |
| `rules.viaForms[]` | The network `via` definitions in file order: `name`, `form` (PadForm), `kind`, `attach: true` if attachment to SMD pads is allowed |
| `rules.viaRules[]` | The via rules in creation order: `name`, `forms[]` (ordered PadForm candidates). See `spec/rules/vias.md` |
| `keepouts[]` | Fence items aggregated by (`scope`, `sheet`, `owner`), sorted by that key: `scope` is `track` (a `keepout`), `barrel` (`via_keepout`) or `place` (`place_keepout`); `sheet` the Sheet name; `owner` `board` for structure-level Fences and `part` for those instantiated from an image; `count` the number of Fence items |
| `outline` | `shapes` (rings in the Rim: outline plus cut-outs), `vertices` (sum of ring vertex counts), `bbox` (of the Rim, file units), and `kind` only when the `boundary` carries a clearance class other than `default` |

A NetGroup's `width`, and every spacing, is reported after the LU rounding of C-04 (`spec/rules/
clearance.md`): widths are rounded to the nearest LU half-width and doubled, spacings are rounded
to the nearest LU then up to the next even LU.

## Boards that do not read

`Issue006-LPC18XX_43XX_SCH.dsn` is not a text file (it is an OLE compound document); `readDsn`
must return `ok: false` for it. Every other board reads with `status: ok`; no corpus board is
`outline-missing`.
