# The session file

The SPECCTRA session (`.ses`) file this router writes (`writeSes`) and applies back
(`applySes`). Written from the DLR (`<session_file_descriptor>` p. 115, `<route_descriptor>`
p. 112, `<library_out_descriptor>` p. 58, `<network_out_descriptor>` p. 70, `<net_out_descriptor>`
p. 68, `<wire_shape_descriptor>` p. 143, `<wire_via_descriptor>` p. 144, `<was_is_descriptor>`
p. 140) and from what the CAD tools that consume sessions require. Clauses are `F-Snn`. The DSN
lexical rules (`dsn.md` section 1) apply to session text as well.

The expected unrouted sessions live in `spec/acceptance/ses/<board>.unrouted.sexp.json`; the
`ses-roundtrip` acceptance case compares the *canonical tree* (section 5) of `writeSes` on a
freshly read board with that file.

## 1. Shape of the file

- **F-S1 Sections.** The file is one `session` scope containing, in this order: `base_design`,
  `placement`, `was_is`, `routes`. `routes` contains, in this order: `resolution`, `parser`,
  `library_out`, `network_out`. No other section is written.
- **F-S2 Names.** `writeSes(layout, opts)` uses the design name `N` given to `readDsn` (the
  acceptance runner passes the board's file name, e.g. `Issue026-J2_reference.dsn`; a caller
  that gives none gets the document's `pcb` name). The session head is `(session S` where `S` is
  `N` with a trailing `.dsn` (any case) replaced by `.ses`, or `N` + `.ses` when it has no such
  suffix; `(base_design N)` follows.
- **F-S3 Layout of the text.** Whitespace, indentation and line breaks are free (section 5
  ignores them). One item per scope entry is conventional.

## 2. Numbers and identifiers

- **F-S20 Coordinates.** Every coordinate, width and diameter in the session is an integer
  count of resolution units: file value × `resolution.perUnit`, rounded to the nearest integer,
  halves toward positive infinity, after conversion from LU with the Frame (`dsn.md` F-43). A
  KiCad board (`um`, 10) with a Part at `135255 -85725` writes `(place J2 1352550 -857250 …)`;
  an Eagle board (`mil`, 2540) with an outline corner at `837.007874` writes `2126000`; a
  LibrePCB board (`mm`, 1000000) writes `21.59` as `21590000`.
- **F-S21 Resolution scopes.** `(resolution U N)` is written twice — inside `placement` and
  inside `routes` — with the document's `resolution.unit` and `perUnit` (`dsn.md` F-40; the
  default `inch 2540000` when the design file had none).
- **F-S22 Rotation.** `(place …)` writes the Part's rotation reduced into `[0, 360)`: as an
  integer when it is integral, otherwise with at most three decimals and no trailing zeros
  (`-90` → `270`, `338.5` → `338.5`, `180.0` → `180`).
- **F-S30 Identifier quoting.** A name is written bare unless it is empty, contains any of
  `(`, `)`, space, `;`, `-`, `_`, `/`, `~`, `{`, `}`, contains a character outside ASCII, or
  begins with a digit or with `-` followed by a digit; then it is enclosed in the document's
  quote character (`dsn.md` F-30; `"` when the design file declared none). A name that contains
  the quote character itself has that character removed before writing (the format has no
  escape). The empty name is written as two quote characters (`""`). Examples:
  `J2` → `J2`; `Via[0-1]_800:400_um` → `"Via[0-1]_800:400_um"`; `Net-(R1-Pad1)` →
  `"Net-(R1-Pad1)"`; `+5V` → `+5V`; `1` → `"1"`; `Modules:ESP-01` → `"Modules:ESP-01"`;
  `` → `""`. Reference A writes an empty name as nothing at all (`(host_version )`, `(component
  (place …`), which no reader can parse back; reference B writes `""`. Ruling: `""`.
- **F-S31 `parser` entries.** `(parser …)` holds `(host_cad X)` when the design file had a
  `host_cad` and `(host_version Y)` when it had a `host_version` (each quoted per F-S30; an
  empty `host_version` becomes `(host_version "")`), and nothing else. With neither, an empty
  `(parser)` is written.

## 3. `placement`

- **F-S32** Every Part that has a location is written, grouped by package: one
  `(component IMAGE …)` per distinct image name (the name the design file gave the image,
  `dsn.md` F-90), holding `(place REF X Y SIDE ROT)` for each Part of that image, `SIDE` being
  `front` or `back` and `ROT` per F-S22; a Part whose position is fixed (`lock_type position`
  in the design file) additionally carries `(lock_type position)`. Parts with no Pads are
  written too (both references omit a Part whose image has neither pins nor outlines, and
  they name merged images differently, `dsn-dialects.md` D-23; the ruling follows the design
  file). Unplaced Parts are not written. The order of components and places is free.
- **F-S33** `(was_is)` is always written and always empty (pin and gate swapping are not
  performed).

## 4. `routes`

### 4.1 `library_out`

- **F-S34** `library_out` lists, as `padstack` scopes, the PadForms in this order: the resolved
  entries of the design file's structure `via` list (regular then spare, `dsn.md` F-69), then
  the resolved `use_via` entries of every class in file order, then any PadForm used by a Barrel
  that is written to `network_out` and not yet listed; each PadForm once (first occurrence),
  under the name it was defined with (`padstack-names.md` P-6). A PadForm entry is
  `(padstack NAME {(shape <shape>)} [(attach off)])` with one `shape` per Sheet on which the
  PadForm has copper, in Stack order, each shape in resolution units relative to the padstack
  origin: `(circle L D CX CY)` (centre always written, `0 0` when centred), `(rect L X1 Y1 X2
  Y2)` with `X1 ≤ X2`, `Y1 ≤ Y2`, `(polygon L 0 X0 Y0 …)`, `(path L W X0 Y0 …)`. `(attach off)`
  is written when `attachAllowed` is false; nothing when true. A PadForm defined on `pcb` or
  `signal` is written once per Sheet with the Sheet's name.

### 4.2 `network_out`

- **F-S40 Which items.** `network_out` holds one `(net NAME …)` per net that owns at least one
  written item, containing the written Tracks, Barrels and Pours of that net. Router-added
  Tracks and Barrels are always written. Items that were read from the design file's `wiring`
  section are written when `opts.includeFileWiring` is true (the default), except that:
- **F-S43** items with Hold `locked` (design-file `(type fix)`, `dsn.md` F-112) are never
  written — the CAD tool keeps its locked tracks on import and would duplicate them otherwise;
  Pours that came from `structure` planes are never written (they are not wiring). Items with
  no net are never written.
- **F-S41 Tracks.** `(wire (path L W X0 Y0 X1 Y1 … Xn Yn) [(type protect)])`: the Track's
  Sheet name, its width, its points in order (consecutive coincident points collapsed; a
  Track with fewer than two distinct points is not written). `(type protect)` is written for
  Hold `held`; no `type` for Hold `free`. A Track read from a `polyline_path` is written as a
  `path` through its corners (`dsn.md` F-54). Net names are written without a subnet number.
- **F-S42 Pours.** A Pour that came from the wiring section is written as
  `(wire (polygon L 0 X0 Y0 … ) {(window (polygon L 0 …))})` with its holes as windows and no
  `type`.
- **F-S44 Barrels.** `(via NAME X Y [(type protect)])` with the PadForm's defined name (F-S34)
  and the centre; `(type protect)` for Hold `held`, nothing for `free`.
- **F-S45 Geometry is written as held, not re-derived.** Points, widths and diameters are the
  Layout's values converted per F-S20 (a width is twice the Track's half width in LU, so with
  one LU per resolution unit an odd file width such as `215.9` µm in a `um 10` board is written
  as `2160`, `dsn.md` F-43); the writer does not merge collinear Tracks, does not remove legs
  that double back, and does not move Track ends into Pads. Reference A does these when it
  reads a design file, so its unrouted session differs from the design file's wiring on a
  dozen corpus boards; section 5 defines the comparison so that only a genuinely different
  centreline counts.
*Amended (Q-I2-52):* a Pour's holes are **not** written (`window` scopes omitted); the CAD tool
re-fills pours on import.

## 5. Canonical tree and the `ses-roundtrip` case

The acceptance runner normalises both the written session and the expected file into a
*canonical tree*: a JSON array whose first element is the head and whose remaining elements are
strings, numbers or nested arrays. The expected trees are produced with the same normalisation.

- **F-S50 Normalisation.** Given session text:
  1. Lex and fold into a tree with the DSN rules (`dsn.md` F-1 … F-13); strip quotes.
  2. Every item that is not a scope becomes a JSON number when its text matches the number
     grammar (`dsn.md` F-6) and is not in a *name position*; integral values become integers,
     others floats. Name positions are item 1 of `session`, `base_design`, `component`, `place`,
     `padstack`, `net`, `via`, `path`, `polygon`, `circle`, `rect`, `resolution`, `host_cad`,
     `host_version`, `type`, `attach`, `layer`, `clearance_class` and `pins` scopes, and item 4
     (the side) of `place`. Everything else in name positions stays a string.
  3. `placement`: keep its `resolution`; merge `component` scopes with the same image name;
     sort components by image name; within a component sort `place` entries by reference then
     by their canonical text; drop anything else.
  4. `was_is`: keep as written (it is empty).
  5. `routes`: keep `resolution`; `parser` reduced to the sorted list of its entry heads
     (`["parser", "host_cad", "host_version"]`) — the values are copied from the design file
     and are not compared; `library_out` with padstacks sorted by name, each padstack's `shape` entries sorted by
     layer name then canonical text, a 3-item `(circle L D)` expanded to `(circle L D 0 0)`,
     and its remaining entries (`attach`) sorted by canonical text; `network_out` with nets
     sorted by name, the entries of a net sorted by canonical text.
  6. Every `path`: consecutive duplicate points removed, then every interior point that lies
     exactly on the straight segment between its neighbours removed (integer cross product zero
     and inside the bounding box of the neighbours), repeated until none remains.
  7. Every `polygon`: the closing vertex dropped when it repeats the first; consecutive
     duplicates removed; the ring reversed if its signed area (shoelace, `y` up) is negative;
     rotated to start at its lexicographically smallest `(x, y)` vertex.
  8. The output is `["session", S, ["base_design", N], ["placement", …], ["was_is"],
     ["routes", …]]`; "canonical text" of a node is its JSON serialisation without whitespace.
- **F-S51 The case.** `ses-roundtrip`: `readDsn(boardText, { name: boardFile })` → `writeSes(layout)`
  → F-S50 → deep-equal with the `tree` field of `spec/acceptance/ses/<board>.unrouted.sexp.json`.
  The expected file is `{ "_generated": string, "board": string, "tree": [...] }`. The
  comparison is exact; no tolerance.
- **F-S52 What the expectation contains.** The expected tree is what F-S1 … F-S45 prescribe
  for the board as read, with the file wiring included. Its `placement` equals both references'
  once their image merging and pinless-part omission are ruled out (D-23, F-S32); its
  `library_out` and via entries equal both references' on every board except for the padstack
  name spelling (P-6: the references write the normalised name, the expectation the defined
  one — 17 and 10 boards respectively); its wire entries equal reference A's after F-S50 on 103 of 115 boards and differ on the 12
  boards where reference A rewrites wiring geometry (F-S45): `Issue022-AutoRouter_interrupted.dsn`,
  `Issue070-Autorouter_FQ101_PCB_2022-05-13.dsn`, `Issue103-Board-Routed.dsn`,
  `Issue187-processor.Z80.dsn`, `Issue575-drc_Natural_Tone_Preamp_7_unconnected_items.dsn`,
  `Issue723-CombineStackOverflow.dsn`, `Issue756-tomu-fpga.dsn`, `Issue756-tomu-fpga11.dsn`,
  `Issue756-tomu-fpga7.dsn`, `Issue756-tomu-fpga8.dsn`, `Issue756-tomu-fpga9.dsn`,
  `Issue191-processor.Z80-processor.Z80.dsn` (legs that double back removed, polygons with windows re-traced, 4 000
  collinear wires merged into 29, polyline corners rounded one unit differently). Reference B's
  sessions equal reference A's after F-S50 on 101 of 115 boards; the rest differ in image
  naming (D-23), `(host_version )` (F-S30) and polygon tracing.

## 6. Applying a session

- **F-S60** `applySes(layout, text)` reads the `routes` / `network_out` section only; the
  `placement`, `was_is`, `library_out` and `parser` sections are ignored (Parts do not move).
  Text without a `session` head returns `ok: false`.
- **F-S61 Replacement.** Before inserting, every Track, Barrel and Pour of the Layout whose Hold
  is `free` or `held` is removed; `locked` items stay. This mirrors the CAD tool, which deletes
  its unlocked tracks and vias on import and keeps locked ones, and it is what makes the
  round trip of `spec/api/contract.md` hold: `writeSes` then `applySes` on a fresh `readDsn` of
  the same board yields the same Track and Barrel counts and the same DRC statistics as the
  Layout that was written. Both references *add* the session's items to whatever the board
  holds (a board with file wiring gets it twice); the ruling follows the CAD tool.
- **F-S62 Items.** Inside each `(net NAME …)`: the net is looked up by exact name (a name that
  is not a net makes the whole net scope skipped with diagnostic `net-unknown`);
  `(wire (path L W …))` and `(wire (polyline_path …))` become Tracks with Hold `held` on Sheet
  `L` (exact name; unknown → diagnostic `layer-unknown`, entry skipped) with coordinates
  divided by `resolution.perUnit` of the *session's* `routes` resolution (default: the
  Layout's); `(wire (polygon …))` becomes a Pour with Hold `held`; `(via NAME X Y …)` becomes a
  Barrel with Hold `held` whose PadForm is resolved per `padstack-names.md` (unknown →
  diagnostic `padstack-unknown`, entry skipped). `type` scopes are ignored. `applied.tracks` and
  `applied.barrels` count the inserted Tracks and Barrels; diagnostics carry one entry per
  skipped item. Pours count in neither.
- **F-S63 Kinds.** Applied items take the Kind (clearance class) of their net's NetGroup, per
  `spec/rules/clearance.md`.
*Amended (Q-I2-53):* when no Sheet has the exact name, `Top` / `Bottom` are accepted as the
first / last Sheet with an `info` diagnostic `layer-aliased`.
