# Observed DSN dialects

Every entry is *observed input* → *required interpretation* → *boards* (file names under
`spec/acceptance/boards/`). `F-nn` clauses are in `dsn.md`. Where the two reference
implementations disagree with each other or with the ruling, the observation and the ruling are
both recorded. "KiCad" below means the host recorded as `KiCad's Pcbnew` with the version in
`host_version`; four exporter families appear in the corpus: KiCad (4.0 … 10.99, about a hundred boards),
Eagle via a user-language script (3 boards), LibrePCB 2.0 (1 board), EasyEDA-style (7 boards:
two declare `EasyEDA Pro`, five carry no `parser` scope at all and share the same layout).

## Encoding, whole-file shape

- **D-1 Not a design file.** `Issue006-LPC18XX_43XX_SCH.dsn` is a binary OLE compound document
  (145 316 NUL bytes in 267 264). Required: `readDsn` returns `ok: false` with a `ParseError`
  (F-20) — the parse status is `parse-error`. Both references reject it.
- **D-2 Character encoding.** All 116 readable boards are valid UTF-8 without a byte-order
  mark; about a dozen contain non-ASCII text (Cyrillic, Chinese, German umlauts, `⌀`, `µ`). Required: F-1.
  Reference A reads the bytes as UTF-8 but its identifier scanner drops every character outside
  Windows-1252 from *bare* names read as identifiers: the bare image name
  `Предохранители:Цилиндр_5х20` becomes `:` and a bare `Соединители:PinSocket…` becomes
  `:PinSocket…`, while quoted names, bare layer names and bare net names survive intact;
  reference B reproduces this. Ruling: names are kept verbatim in every position (F-5, F-61,
  F-90). Boards: `Issue110-Pajalnaja_stancija.dsn` (bare Cyrillic layer names
  `Верхний_сигнальный` / `Нижний_сигнальный`, bare Cyrillic part numbers), `Issue110-Паяльная
  станция.dsn` (same content, Cyrillic file name), `Issue110-RelayModule.dsn` (bare and quoted
  Cyrillic image names, quoted Cyrillic part numbers), `Issue093-interf_u.dsn` (Chinese directory in the design
  name), `Issue199-StackOverflow-Signale_Vor+Block.dsn` (`Schaltpläne`), `Issue676-ch32v-tx118s.dsn` (`⌀` in image
  names), `Issue742-tastexx-pcb.dsn`, `Issue367-Charger.dsn`, `Issue297-myboard.dsn`,
  `Issue163-pic_programmer.dsn`, `Issue575-drc_Natural_Tone_Preamp_7_unconnected_items.dsn`.
- **D-3 Line endings and layout.** Files use LF only; KiCad indents with spaces and breaks
  long lists across lines; the EasyEDA-style files write `(rule(clear 0.605))` with no space
  after `(` and `(place u1 0 0 front 0\n      )`. Required: F-2 / F-3 (whitespace is never
  significant except as a separator; a scope head may directly follow `(`).
- **D-4 Design name.** KiCad writes the full export path as a quoted string with backslashes
  (`"F:\Spiwocoal\Documentos\…\Main ISO.dsn"`, `Issue035-ReadPlaceScope.dsn`) or forward slashes
  and spaces; Eagle writes `"untitled.brd"`; EasyEDA-style writes the empty single-quoted name
  `''`; LibrePCB writes a bare name. Required: F-4 (backslashes are not escapes), F-20 (an empty
  name is a name).

## Numbers and identifiers

- **D-5 Resolutions and units seen.** `(resolution um 10) (unit um)`: all KiCad boards.
  `(resolution mil 2540) (unit mil)`: Eagle (`Issue143-rpi_splitter.dsn`,
  `Issue143-rpi_splitter_mod.dsn`, `Issue270-non-ansi_bracket.dsn`). `(resolution mm 1000000)
  (unit mm)`: LibrePCB (`Issue676-ch32v-tx118s.dsn`). `(resolution mil 1000)` with no `unit`:
  EasyEDA-style (`Issue070-Autorouter_FQ101_PCB_2022-05-13.dsn`,
  `Issue179-Autorouter_PCB1_2023-3-24.dsn`, `Issue289-Autorouter_PCB_FHT-8086_2024-03-08.dsn`,
  `Issue289-Autorouter_PCB_FHT-VGA_2024-03-25.dsn`, `Issue313-FastTest.dsn`,
  `Issue684-Autorouter_PCB1_2026-5-8.dsn`, `Issue721-Autorouter_CE2632_HarryMu_2026-6-15.dsn`).
  `(resolution um 10)` with no `unit`: `Issue187-processor.Z80.dsn`, `Issue191-processor.Z80-processor.Z80.dsn`.
  Required: F-40, F-41 (a missing `unit` means the resolution unit).
- **D-6 Keyword case.** `(PCB …` (upper case) opens Eagle, EasyEDA-style and router-written
  files (`Issue143-rpi_splitter.dsn`, `Issue070-Autorouter_FQ101_PCB_2022-05-13.dsn`,
  `Issue103-Board-Routed.dsn`); everything else is lower case. Required: F-10. Reference A
  accepts an irregular set of case variants (`Rect`, `VIA`, `Circle` but not every upper-case
  spelling); reference B accepts a slightly different set (`RECT` is a name to B and a keyword
  to A). Ruling: every head is case-insensitive.
- **D-7 Exponent numbers in value positions.** `(rotate 1e-07)` and `(rotate 2e-08)` on image
  pins (KiCad 6.0.9 / 7.0.5 exports of footprints with sub-microdegree pad rotations).
  Required: F-6 — the value is 10⁻⁷ / 2·10⁻⁸ degrees (F-91). Reference A's tokenizer splits
  `1e-07` into `1.0` and `7` because its exponent may not carry a leading zero, but the rotation
  is read through a separate number parser and comes out right; reference B reproduces both.
  Boards: `Issue157-TeamAdapt-LinePCB.dsn` (`1e-07`, 2 pins), `Issue214-router.dsn`
  (`2e-08`, 4 pins).
- **D-8 Names that lex as numbers.** Pin names `1` … `20` (every board), pin names `0e29`,
  `2e7`, `10e12`, `1221e15` and pin references `u1-1e31` (EasyEDA Pro: `Issue684-…`,
  `Issue721-…`), pin names `101e7` (`Issue179-Autorouter_PCB1_2023-3-24.dsn`), layer names `1`,
  `2`, `15`, `16` (all EasyEDA-style boards), net names `100`, `94` and `" 1"` (a quoted name
  with a leading space, `Issue753-CPU-85_r104.dsn`), image name `15pin:09561617712` and part
  number `(PN 09561617712)` (`Issue754-avionics_hub.dsn`), image pin `1.0`-style names in
  `Issue103-Board-Routed.dsn`. Required: F-7 — the name is the source text. Reference A reads
  names in a mode where a number is a string, so `0e29` survives; a bare `09561617712` survives
  too. Reference B reproduces this.
- **D-9 Bare punctuation as part numbers.** KiCad 5.1.2 writes single-character part numbers
  unquoted: `(PN \)`, `(PN ,)`, `(PN .)`, `(PN /)`, `(PN [)`, `(PN ])`, `(PN 7)`, `(PN 0.1u)`,
  `(PN nice!nano)`; `#` and names with spaces are quoted (`(PN "#")`, `(PN "Caps Lock")`).
  Required: F-5, F-7, F-81 — all 141 Parts of `Issue035-ReadPlaceScope.dsn` and all Parts of
  `Issue054-tairakb.dsn` read. Both references read all of them.
- **D-10 Identifier characters.** Bare names contain `-`, `.`, `/`, `:`, `#`, `$`, `@`, `!`,
  `+`, `~`, `{`, `}`, `[`, `]`, `,`, `\`, `'`, `=`, `;`: `/CM5/PCIE_PI.CLK_N`,
  `Capacitor_SMD:C_0603_1608Metric::1` (KiCad image names), `+3V3`, `+5V0-1` (net names),
  `1@1`, `W4F1-1@1` (pin names and pin references, `Issue015-StackOverflow.dsn`),
  `Round1$13.779528` (Eagle padstack), `~{WAIT}`, `~{BAI}` (KiCad 6+ active-low net names,
  bare, `Issue187-processor.Z80.dsn`), `/B_LCAS{slash}CAS0` (quoted, `Issue113-Protein.dsn`),
  `/~{SD_SS}` (quoted, `Issue155-CH376_MCP795_Module.dsn`), `1#Top` (quoted Eagle layer name).
  Required: F-5 — all are single bare or quoted lexemes; `{`, `}`, `|` and `` ` `` are ordinary
  characters. Reference A's tokenizer treats `{`, `}`, `|`, `` ` `` as characters to skip, which
  splits a bare word around them; net names are read through a different path in which they
  survive (`~{WAIT}` is a net in reference A's board). Ruling: ordinary characters everywhere.
- **D-11 Quote characters.** `"` is the declared quote character in every file that declares
  one. `'` occurs (a) as a quote character in EasyEDA-style files that declare none: `(PCB ''`,
  `(class '' …)`, `(class $1N4396 '$1N4396' …)` (`Issue684-…`, `Issue721-…`,
  `Issue070-…`, `Issue313-…`); (b) *inside* bare names: pin names `A'`, `B'` and pin references
  `SW1-A'` (`Issue508-DAC2020_bm02.dsn`); (c) inside `"`-quoted strings: `"KiCad's Pcbnew"`
  (every KiCad board), `"2x20 pin 0.1'' female header"` (`Issue756-tomu-fpga.dsn`). Required:
  F-4 and F-5 together — a quote character opens a string only at the start of a lexeme.
- **D-12 Non-ASCII bare names.** See D-2. Required: F-5.
- **D-13 Windows paths and backslashes.** Design names such as
  `"C:\Users\…\hw72nb.dsn"` (`Issue015-StackOverflow.dsn`, `Issue022-AutoRouter_interrupted.dsn`,
  `Issue034-Green14SegLED.dsn`, `Issue069-TestSensel-TestSensel.dsn`, …). Required: F-4 (no escapes).
- **D-14 `$` in names.** `ViaDefault$13.779528`, `Round1$13.779528` (Eagle padstacks),
  `$1N4396` (EasyEDA nets). Required: F-4 (`$` never quotes), F-5.

## Exporter families

- **D-15 Eagle (exported by a user-language script, host `CadSoft`).** Observed: `(host_cad CadSoft)`
  unquoted; `(case_sensitive off) (via_rotate_first on)` in `parser`; layers `"1#Top"`,
  `"16#Bottom"`; two boundaries — `(boundary (rect pcb 0 0 837.007874 1649.606299))` and
  `(boundary (path signal 0 …) (clearance_class boundary))`; six-decimal coordinates;
  `(control (via_at_smd on))`; `(rule (width 16.000000)(clearance 12.000000))` plus
  per-object-pair clearances `default_boundary`, `wire_via`, `pin_pin`, `pin_via`, `via_via`,
  `smd_pin`, `smd_via`, `smd_smd`, `area_wire`, …; `circ` as the circle head; `(flip_style
  rotate_first)` in the structure; quoted pin references `"J1"-"D+"`. Required: F-10 (aliases),
  F-62/F-63 (the `rect pcb` is the bounding rectangle, the `path signal` ring is the Rim, the
  Rim's Kind is `boundary`), F-72, F-74 (rotate-first placement), F-101, and
  `spec/rules/clearance.md` for the pair types. Boards: `Issue143-rpi_splitter.dsn`,
  `Issue143-rpi_splitter_mod.dsn`, `Issue270-non-ansi_bracket.dsn`.
- **D-16 EasyEDA-style (no `parser` scope, or `EasyEDA Pro`).** Observed: `(PCB ''` or
  `(PCB "PCB1"`; `(resolution mil 1000)` and no `unit`; `(boundary(path signal 0 …))` only —
  no `pcb` boundary; `(via via4 via0 …)`; `(grid via 0.25) (grid wire 0.25) (grid place 0.25)`;
  `(rule(clear 0.605))`, `(rule(clear 0.605 (type default_smd)))`, `(rule(clear 0.605 (type
  smd_smd)))`, `(rule(width 0.605))`; layers named `1`, `2` (and `15`, `16` in 4-layer files);
  one image `u1` holding every pad of the board as pins named like `887`, `0e29`; a single
  component `u1` placed at the origin; padstacks named `p887`, `p0e29`, `p38e5` with polygon
  shapes on layer `1` and aperture `0.01`; classes named by net (`(class $1N4396 '$1N4396' …)`)
  and one class with the empty name. Required: F-33 (no parser scope is fine), F-63 (a
  `signal` path ring is the Rim), F-75 (grids ignored), F-10 (`clear`), F-7 (numeric layer and
  pin names), F-102 (empty class name). Boards: `Issue070-Autorouter_FQ101_PCB_2022-05-13.dsn`,
  `Issue179-Autorouter_PCB1_2023-3-24.dsn`, `Issue289-Autorouter_PCB_FHT-8086_2024-03-08.dsn`,
  `Issue289-Autorouter_PCB_FHT-VGA_2024-03-25.dsn`, `Issue313-FastTest.dsn`,
  `Issue684-Autorouter_PCB1_2026-5-8.dsn`, `Issue721-Autorouter_CE2632_HarryMu_2026-6-15.dsn`.
- **D-17 Empty class name.** `(class '' (circuit (use_via via0)) (rule (width 15.75) (clearance
  0.8)))` — a NetGroup whose name is the empty string and which lists no nets. Required: F-102
  (kept as a group named `""`; it affects nothing unless a net names it). Boards: the EasyEDA
  Pro boards of D-16.
- **D-18 LibrePCB 2.0.** Observed: `(pcb ch32v-tx118s` bare; `(resolution mm 1000000) (unit
  mm)`; every number with a decimal point (`0.0`, `21.59`); `(layer top_cu (type signal))`;
  `(boundary (path pcb 0.0 …))`; `(plane "GND" (polygon top_cu 0.0 …))`; a via named
  `"via-0.5:auto-1.0:auto-tht"`; `(clearance 0.0 (type smd_via_same_net))` and
  `via_via_same_net`; components named `"J3:Soldered Wire Connector 1x01 ⌀1.0mm"`; a component
  `BOARD` with an image of no pins; `(place "C1" 19.685 10.795 front 270.0)` with a real
  rotation; padstacks whose names contain `:` and `-` but no `_` before the `:` (so no drill can
  be inferred from the name, `padstack-names.md`). Required: F-6 (`0.0` is 0), F-80 (rotation
  `270.0`), F-91, `padstack-names.md` P-10. Board: `Issue676-ch32v-tx118s.dsn`.
- **D-19 `unit` handling.** See D-5. The references ignore the `unit` scope and interpret every
  number in the resolution unit; the specification honours `unit` (F-41). In the corpus the two
  never differ, so no board distinguishes the readings.
- **D-20 Router-written design files.** Files exported by a router rather than by a CAD tool:
  `(PCB "ERISC 4"`, a `parser` with `(generated_by_…)`, `(structure … (snap_angle
  fortyfive_degree) (control (via_at_smd off)) (autoroute_settings …))`, both a `pcb` and a
  `signal` boundary, `(via "Via[0-1]_600:300_um" "Via[0-1]_600:300_um")` with a repeated name,
  `(clearance 200.0 (type kicad))` (a clearance type naming a class that does not exist),
  images with `(side front)`, net scopes with an explicit subnet number `(net "/datEx16" 1 …)`,
  classes with `(circuit (use_layer F.Cu B.Cu))` and `(via_rule …)`, wiring written as
  `polyline_path` with `(clearance_class "kicad_default")` and `(type shove_fixed)`. Required:
  F-54 (polyline corners), F-69 (duplicate via names de-duplicated), F-73, F-100, F-112
  (`shove_fixed` is `free`), and `spec/rules/clearance.md` for a `type` that names no class.
  Boards: `Issue103-Board-Routed.dsn`, `Issue187-processor.Z80.dsn`, `Issue191-processor.Z80-processor.Z80.dsn`,
  `Issue413-test.dsn`.

## Structure quirks

- **D-21 Keepouts on the `pcb` pseudo-layer.** No corpus board has one (all corpus keepouts are
  on `signal` — 67 boards — or on a named layer). Both references reject a `pcb`-layer keepout
  (the board fails to read). Ruling: F-66, a `pcb` keepout is a Fence on every Sheet, because
  that is what the DLR's reserved layer name means and refusing the whole board is the worse
  failure.
- **D-22 `signal`-pseudo-layer shapes.** Keepouts `(keepout "" (polygon signal 0 …))` (KiCad
  zones with "no tracks" on all copper layers; `Issue015-StackOverflow.dsn`,
  `Issue178-KeebMaker_Sofle_Choc.dsn` with 59 of them), boundaries `(path signal 0 …)`
  (D-15, D-16), image outlines `(outline (path signal 120 …))` (every KiCad board),
  `(clearance … (type …))` lists are unrelated. Required: F-66 (one Fence per signal Sheet),
  F-63, F-92. Image dedup note: both references merge images (see D-23).
- **D-23 Image variants `::N` and same-named images.** KiCad writes one image per distinct pad
  set and suffixes variants: `Capacitor_SMD:C_0603_1608Metric` and
  `Capacitor_SMD:C_0603_1608Metric::1` (`Issue015-StackOverflow.dsn`), up to `::56`
  (`Issue178-KeebMaker_Sofle_Choc.dsn`). Two images may differ only by a pad offset of 0.001
  file units (`easyeda2kicad:LED-SMD_6P-L5.0-W5.0-TL` and `…::1`, `Issue297-myboard.dsn`).
  Required: F-90 — names verbatim, no merging; a Part's package is the image the file named.
  Reference A strips the suffix, merges an image into an earlier one when every pin coincides
  after rounding to its grid, and re-numbers the rest from `::1` in order of appearance;
  reference B does the same with a different tie-break, so the two disagree on which Parts
  belong to which `::N` package on 14 boards (`Issue066-Project_GP8B.dsn`,
  `Issue102-Mars-64-revE-rot00.dsn`, `Issue153-wavefolder.dsn`, `Issue283-UnconnectedTracesUnderPads-Natural_Tone_Preamp.dsn`, …).
  Ruling: no merging; the session's `placement` therefore names the file's image (`ses.md`
  F-S32).
- **D-24 Degenerate keepout.** `(keepout "" (polygon signal 0 19220 -19695 19220 -19695 19220
  -19695))` — three identical vertices (KiCad 4.0.7). Required: F-67 — skipped with a
  diagnostic, the board reads and routes. Both references skip it. Board:
  `Issue229-display-8-digit-hc595.dsn`.
- **D-25 Degenerate padstack shape.** No corpus board defines one; reference A enlarges a
  zero-area pad shape by one LU with a warning. Ruling: F-96 (dropped with a diagnostic).
- **D-26 Concave pad polygons.** KiCad `Cust[T]Pad_…` custom pads and `RoundRect[T]Pad_…`
  polygon approximations (`Issue034-Green14SegLED.dsn`, `Issue039-bug-design.dsn`,
  `Issue508-DAC2020_bm06.dsn`; 99 boards carry polygon pad shapes, most convex). Reference A
  routes and checks against the convex hull of a concave pad polygon. Ruling: F-98 — the exact
  polygon is the copper; a router may use the hull for its own clearance queries.
- **D-27 Empty net name in a class list.** KiCad 8.0.0 … 10.x write `(class kicad_default ""
  GND …)`: the first net of the default class is the empty string (the "no net"). Required:
  F-102 — the `""` entry is ignored. Reference A drops an empty *first* entry and would stop the
  list at a later one; reference B reproduces this. Ruling: ignored wherever it occurs.
  Boards: `Issue269-z10_module.dsn`, `Issue297-myboard.dsn`, `Issue269-min_fr_test-min_fr_test.dsn` (and
  `Issue269-min_fr_test-min_fr_test_no_quotes.dsn`, the same board with the `""` removed — both must read to the same
  Layout).
- **D-28 Duplicate padstack definitions.** KiCad 5 writes the same custom-pad name twice with
  different polygons (`Cust[T]Pad_1000x500_1000x_1500_23_um` in `Issue034-Green14SegLED.dsn`,
  `Issue039-bug-design.dsn`, `Issue102-Mars-64-revE-rot00.dsn`, `Issue145-smoothieboard.dsn`,
  `Issue326-Mars-64-revE.dsn`) and two via definitions whose names differ only in decimals
  (`Via[0-1]_1541.78:1186.18_um` and `Via[0-1]_1541.8:1186.18_um`, `Issue015-StackOverflow.dsn`,
  `Issue022-AutoRouter_interrupted.dsn`); KiCad 7 writes `RoundRect[A][600,0]Pad_2600x1600_401.522_um_0.000000_0`
  and `…2600x1600.2_401.572_um_0.000000_0` (`Issue209-split05.dsn`, `Issue209-split10.dsn`),
  which normalise to one name. Required: F-97 and `padstack-names.md` P-5 — the first
  definition wins. Both references keep the first.
- **D-29 Keepout without a name.** `(keepout (polygon F.Cu 0 …))` — the shape directly after the
  head. Required: F-66 (the name is optional). Boards: `Issue413-test.dsn`,
  `Issue754-avionics_hub.dsn` (`wire_keepout ""` on a signal layer named `Ground`),
  `Issue039-bug-design.dsn` and `Issue732-RoyalBlue54L-Feather.dsn` (`via_keepout ""`).
- **D-30 Planes on signal layers and `power` layers.** KiCad exports every filled zone as
  `(plane NET (polygon LAYER 0 …))` on signal layers (`Issue367-Charger.dsn` has 22,
  `Issue732-CM5_MINIMA_3.dsn` 18); ten boards declare `(type power)` layers
  (`Issue145-smoothieboard.dsn`, `Issue230-CNH_Functional_Tester_1.dsn`,
  `Issue269-NoViasOnPowerPlanes-Issue269-NoViasOnPowerPlanes.dsn`, `Issue269-caniot-tiny-arm.dsn`, `Issue269-z10_module.dsn`,
  `Issue555-CNH_Functional_Tester_1.dsn`, `Issue733-kicad_complex_hierarchy_input_design.dsn`,
  `Issue753-CPU-85_r104.dsn`), some of them with `(use_net …)` and no plane shape. Required:
  F-60, F-68 and `spec/rules/layers.md` (which also records the references' "large pour on an
  inner layer with no wires makes that layer a plane" behaviour).
- **D-31 Wiring polygons with windows.** KiCad 10.99 development builds write filled zones in
  `wiring` as `(wire (polygon F.Cu 0 …)(net +3V3)(type protect) (window (polygon F.Cu 0 …)))`
  (`Issue756-tomu-fpga7.dsn`, `Issue756-tomu-fpga8.dsn`, `Issue756-tomu-fpga9.dsn`; 13–14 per
  board). Required: F-110 (a Pour with holes, Hold `held`), `ses.md` F-S42 (written back as a
  polygon wire without `type`).
- **D-32 Collinear micro-wires.** `Issue723-CombineStackOverflow.dsn` (hand-made) has 4 000
  collinear 200 µm `GND` wires end to end on one Sheet. Required: F-110 — 4 000 Tracks are read;
  whether a router merges collinear same-net Tracks is its own business (`ses.md` F-S50 makes
  the session comparison insensitive to it). Both references merge them into 29 Tracks.
- **D-33 Locked (`fix`) wiring only.** `Issue753-CPU-85_r104.dsn` carries 65 wires and 19 vias
  all `(type fix)`. Required: F-112 (`locked`), `ses.md` F-S43 (not written back).
- **D-34 Wire types across KiCad versions.** KiCad 4/5 write `(type protect)` on every track;
  KiCad 6+ write `(type route)`; locked tracks are `(type fix)`
  (`Issue230-CNH_Functional_Tester_1.dsn`: 8 `fix` wires). Required: F-112.
- **D-35 Pin references with hyphens in names.** `B1--`, `U18--`, `U19--` (pin named `-`),
  `SW1-A'`, `X4-MT1`, `"FP-Altair1"-1` (component name containing `-`, quoted),
  `"J1"-"D+"`, `"J3-"-"D+"`, `"J2(--)"-"GND"`, `"J1 + - ( )"-"GND"`, `"J3 -+"-"_VBUS #22"`,
  `J2-VBUS "J1"-VBUS`. Required: F-101. Boards: `Issue508-DAC2020_bm02.dsn`,
  `Issue270-non-ansi_bracket.dsn`, `Issue753-CPU-85_r104.dsn`, `Issue143-rpi_splitter.dsn`,
  `Issue143-rpi_splitter_mod.dsn` (a hand-edited stress file whose odd component names do not
  exist: those entries are `pin-unknown` and the board still reads).
- **D-36 Old KiCad quirks.** KiCad 4.0.1 / 4.0.7 exports: stray quotes in part numbers
  (F-14, `Issue229-display-8-digit-hc595.dsn`), the degenerate keepout of D-24, and via padstack
  names with decimals (`Via[0-1]_1016:485.7_um`). Required: read as the clauses say; the
  references additionally log a warning recommending a newer KiCad — no observable effect.
- **D-37 Empty `host_version`.** `(host_version "")` (`Issue420-contribution-board.dsn`,
  `Issue433-my-board.dsn`). Required: F-32 (an empty string); the session writes it back as
  `(host_version "")` (`ses.md` F-S31 — reference A writes `(host_version )`, reference B
  `(host_version "")`; ruling: B).
- **D-38 Padstack names with decimals.** Every KiCad board: `RoundRect[T]Pad_875x950_219.582_um`,
  `Round[A]Pad_1320.800000_um`, `Via[0-1]_685.8:330.2_um`,
  `RoundRect[T]Pad_3199.9935999999993x1599.9967999999997_um` (`Issue420-contribution-board.dsn`).
  Required: `padstack-names.md`.

## From S2

Entries handed over by the parse-summary reconciliation (task S2) are appended here under this
heading, numbered from `D-100`.
