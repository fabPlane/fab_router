# The DSN design file

The SPECCTRA design file as this router must read it. Written from the published *SPECCTRA
Design Language Reference* (Cadence, v10.0, May 2000; cited below as **DLR** with the descriptor
name and page) and from the observed behaviour of the board corpus in `spec/acceptance/boards/`.
Exporter-specific quirks are catalogued in `dsn-dialects.md` (clauses `D-nn`); padstack name
resolution in `padstack-names.md`; the session file in `ses.md`; rules files in `rules.md`.
Normative statements are numbered `F-nn`. Vocabulary is that of `spec/glossary.md`.

The reader's job is two-fold: produce the **document** (`DsnDocument`, section 13: a
file-shaped record in file units that preserves what the file said) and, from it, the **Layout**
(`spec/types/layout.ts`) whose semantics are in `spec/rules/`. This file specifies the document
and the geometric meaning of the file; rule semantics (clearance, nets, vias, keepouts, layers,
connectivity) are in `spec/rules/*.md`.

## 1. Encoding and lexical structure

The file is a text of nested parenthesised scopes (DLR *Syntax Conventions*, p. 7). The lexeme
vectors in `spec/behaviour/dsn-tokens/*.jsonl` are the test of this section.

- **F-1 Decoding.** The bytes are decoded as UTF-8. An initial byte-order mark (`EF BB BF`) is
  dropped. Byte sequences that are not valid UTF-8 are decoded as Windows-1252 characters (one
  character per byte); decoding never fails. Every board in the corpus is valid UTF-8 except the
  one that is not a design file at all (`D-1`).
- **F-2 Separators.** Space, tab, carriage return, line feed, form feed and vertical tab separate
  lexemes. Every other control character below `U+0020` (including `NUL`) is also a separator.
- **F-3 Parentheses.** `(` and `)` are always single-character lexemes of kind `open` / `close`,
  except inside a quoted string (F-4).
- **F-4 Quoted strings.** The document has exactly one *quote character*: the one declared by
  `(string_quote c)` in the `parser` scope (F-11, F-30), from that declaration onward, and `"`
  before it or when nothing is declared. The DLR allows `"`, `'` and `$` as the declared
  character (`<parser_descriptor>`, p. 81); every corpus board that declares one declares `"`.
  The quote character standing at the start of a lexeme opens a quoted string of kind `string`,
  which ends at the next occurrence of the same character. There is no escape mechanism: a
  backslash is an ordinary character, and parentheses, spaces and line breaks inside the string
  are ordinary characters (the string may span lines). The string's text excludes the two quotes
  and may be empty. An unterminated string runs to the end of the input. **Any other quote-like
  character is an ordinary character everywhere**: with `"` in effect, `'` starts or continues a
  bare lexeme (`''` is a two-character bare name, `'$1N4396'` a nine-character one, `D-11`,
  `D-17`) and is plain text inside a string (`"KiCad's Pcbnew"`); with `'` declared, `"` is
  ordinary in the same way. Ruling Q-I1-29: this is the published format's rule, and it is how
  both references read every name position of every corpus board (both read `(class '' …)` as
  a NetGroup named `''`); their standalone tokenisers treat `'` as a second quote character and
  they ignore a declared `'`, which `D-11` records, but no corpus board's observable output
  depends on that.
- **F-5 Bare lexemes.** Any other character starts a bare lexeme, which extends up to (not
  including) the next separator, parenthesis or end of input. Quote characters that occur *inside*
  a bare lexeme are ordinary characters: `A'`, `SW1-A'`, `-"D+"` are single bare lexemes. Every
  non-separator Unicode character is allowed in a bare lexeme (`D-10`, `D-12`); the DLR's
  `<special_character>` set (p. 120) is a subset of this.
- **F-6 Numbers.** A bare lexeme whose whole text matches `[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?`
  is of kind `number`; its value is the usual decimal / scientific value (`1e-07` is 10⁻⁷, `.5`
  is 0.5, `42.` is 42, `+42` is 42, `007` is 7, `0e29` is 0). Every other bare lexeme is of kind
  `ident`. The lexeme always keeps its exact source text.
- **F-7 Names spelled like numbers.** Wherever the grammar expects a name (a pin name, a
  component reference, a layer name, a net name, a part number, a padstack name, a class name,
  …) and the lexeme is a `number`, the name is the lexeme's *source text*, not a re-formatted
  value: pin `1.0` stays `1.0`, part number `09561617712` stays `09561617712`, layer `1` stays
  `1`, pin `0e29` stays `0e29` (`D-8`, `D-9`).
- **F-8 Numbers spelled as names.** Wherever the grammar expects a number and the lexeme is a
  `string` or `ident`, the reader attempts the same number grammar on its text (a quoted `"5"`
  is 5); if that fails the value is absent and the enclosing entry is handled as F-24 says.
- **F-9 Adjacency.** Two lexemes are *adjacent* when no separator lies between them. The reader
  must be able to tell adjacency for the entries of a `pins` / `order` / `fromto` list (F-101);
  the lexeme vectors mark a lexeme that is adjacent to the previous one with `"glued": true`.
- **F-10 Keyword spelling.** Scope heads (the first lexeme after `(`) are compared
  case-insensitively: `PCB`, `Rect`, `VIA`, `Circle`, `RECT` are the heads `pcb`, `rect`, `via`,
  `circle`, `rect` (`D-6`). The aliases `circ` = `circle`, `rectangle` = `rect`, `poly` =
  `polygon`, `clear` = `clearance`, `comp` = `component` are accepted (DLR uses the long spellings;
  Eagle writes `circ`, `D-15`). Keyword tokens that are not scope heads (`on`, `off`, `front`,
  `back`, `signal`, `power`, `pcb`, `horizontal`, `vertical`, `fix`, `route`, `normal`,
  `protect`, `ninety_degree`, `fortyfive_degree`, `none`, `mirror_first`, `rotate_first`, …) are
  likewise compared case-insensitively.
- **F-11 The `string_quote` exception.** The lexeme that immediately follows the head
  `string_quote` is read as a bare lexeme even when it begins with a quote character: in
  `(string_quote ")` the value is the one-character text `"`. This is the only place where the
  quote character in effect does not open a string; the declared character is the document's
  quote character from there on (F-4).
- **F-12 No comments.** There is no comment syntax. `#` and `/*` are ordinary identifier
  characters (`1#Top` is a layer name in `Issue270-non-ansi_bracket.dsn`). Reference A strips
  `#`-to-end-of-line and `/* … */` as comments; reference B and this specification do not,
  because the DLR defines no comments and the corpus contains none.
- **F-13 Tree.** The lexeme stream is folded into a tree: `open` starts a scope, `close` ends the
  innermost open scope, and every other lexeme is an item of the innermost open scope. A `close`
  with no open scope is ignored with diagnostic `stray-close`. Scopes still open at end of input
  are closed with diagnostic `unclosed-scope`. The first item of a scope, if it is an `ident` or
  a `number`, is the scope's *head*; a scope with no head or a `string` first item is retained as
  an anonymous scope. Line and column of every lexeme are available for diagnostics.
- **F-14 Stray quotes.** Because of F-4, one stray quote character swallows everything up to the
  next quote character, including parentheses. The reader does not try to repair this; it reads
  the resulting tree as it is. Consequence on `Issue229-display-8-digit-hc595.dsn`: the part
  numbers `"DISPLAY 7-SEG 0.5""` contain an inch mark, the doubled quote swallows the following
  `place` entry, and the board reads with 22 Parts instead of 26 (`DP3`, `DP5`, `DP6`, `DP8` are
  lost). Both references lose the same four Parts. A diagnostic `string-spans-lines` (info) is
  emitted for every string lexeme that contains a line break.

## 2. Document structure

- **F-20 Header.** The file must begin (after separators) with `(` followed by the head `pcb`
  (any case) and then the design name, which may be a bare lexeme, a quoted string (possibly
  empty) or absent; the EasyEDA `(PCB ''` of `D-16` is the two-character bare name `''` (F-4). Otherwise `readDsn` fails with `ok: false` and a
  `ParseError` positioned at the first lexeme (`D-1`). Nothing else makes `readDsn` fail.
- **F-21 Sections.** Directly inside `pcb` the reader recognises the heads `parser`,
  `resolution`, `unit`, `structure`, `placement`, `library`, `network`, `wiring` (DLR
  `<design_descriptor>`, p. 8). `structure` also nests: `structure` scopes found inside
  `placement`, `library`, `network` or `wiring`, and `library` / `network` / `wiring` scopes found
  inside `placement`, are read as if they were at the top level (a lost parenthesis in a
  placement entry must not swallow the rest of the board; no corpus board exercises this). Each recognised section may
  appear once; a repeated section merges its entries into the first (diagnostic
  `duplicate-section`).
- **F-22 Unknown scopes.** Any scope whose head is not recognised at its position is skipped as a
  whole and retained in the enclosing record's `other` list (section 13). Diagnostic
  `unknown-scope` (info) with the head and line. The reader never fails on an unknown scope.
- **F-23 Missing sections.** A missing `structure` yields a Layout with no Sheets and no Rim;
  `readDsn` still returns `ok: true` (diagnostic `structure-missing`, warning). Missing
  `placement`, `library`, `network` or `wiring` are empty. `empty_board.dsn` (a structure with
  two Sheets, a boundary, no parts) reads with status `ok`.
- **F-24 Malformed entries.** An entry that lacks a required item (a `pin` with fewer than two
  coordinates, a `place` whose coordinates are not numbers, a `rect` with fewer than four
  numbers, a `via` without a padstack name, …) is dropped with diagnostic `malformed-<head>`
  (warning) and reading continues with the next entry. Extra items after the required ones are
  ignored.

## 3. `parser`

DLR `<parser_descriptor>`, p. 81.

- **F-30** `(string_quote c)` records the quote character `c` (F-11). Default `"`. It is the
  document's only quote character, for reading (F-4) and for writing (`ses.md` F-S30,
  `writeDsn`).
- **F-31** `(space_in_quoted_tokens on|off)` is recorded; reading always allows spaces inside
  quoted strings (every KiCad file in the corpus declares `on`; the EasyEDA files declare
  nothing and contain no quoted spaces).
- **F-32** `(host_cad x)` and `(host_version x)` are recorded as strings when present (the value
  may be an empty string: `(host_version "")` in `Issue420-contribution-board.dsn`; absent
  entries are `undefined`). `(constant a b)` entries, `(write_resolution u n)`,
  `(case_sensitive on|off)`, `(via_rotate_first on|off)` and the marker scopes that
  router-written files carry (heads beginning with `generated_by_`) are retained verbatim in
  `parser.other` and have no effect on reading. Names are compared case-sensitively everywhere regardless of `case_sensitive`.
- **F-33** A missing `parser` scope is not an error (`D-16`, `D-17`).

## 4. `resolution`, `unit` and coordinates

DLR `<resolution_descriptor>`, p. 108; `<unit_descriptor>`, p. 135; `<dimension_unit>`, p. 34.

- **F-40** `(resolution U N)`: `U` is one of `inch`, `mil`, `cm`, `mm`, `um`; `N` a positive
  integer. Default when absent: `inch` and `2540000`. The pair is exposed as
  `document.resolution = { unit, perUnit }`.
- **F-41** `(unit U)` names the unit in which every coordinate, width, diameter and clearance in
  the file is written. When absent, `unit = resolution.unit`. In every corpus board that has a
  `unit`, it equals the resolution unit; the references ignore `unit` entirely, this
  specification honours it (`D-19`).
- **F-42 Physical meaning.** A file number `v` in a coordinate position means `v` file units
  (F-41). One resolution unit is `1 / perUnit` of `resolution.unit`. A session file coordinate is
  an integer count of resolution units (`ses.md` F-S20): a KiCad file (`um`, 10) writes `135255`
  for 135.255 mm and its session writes `1352550`.
- **F-43 Layout units.** The Frame maps file units to layout units (LU) as `docs/DESIGN.md` §1
  recommends: `luPerUnit` is a positive integer or the reciprocal of one, chosen so that every
  coordinate of the board fits `|coord| ≤ 2^25`, and never finer than 1 nm. Distances are
  converted with the same factor; a value that is not an integer after conversion is rounded to
  the nearest LU, halves toward positive infinity (`Math.round`). A circle's radius in LU is
  `round(diameter × luPerUnit / 2)`; a path's half width is `round(width × luPerUnit / 2)`.
  Observable consequence: the diameter written back to a session for a via padstack of file
  diameter `2.441` mil in a `(resolution mil 1000)` board is `2442` (radius 1221 LU × 2), as both
  references write (`Issue289-Autorouter_PCB_FHT-8086_2024-03-08.dsn`).
- **F-44 Unit scopes inside sections.** A `unit` or `resolution` scope inside `structure`,
  `placement`, `library` or `wiring` (allowed by the DLR) is retained in that section's `other`
  and *not* honoured; diagnostic `unit-in-section` (warning). No corpus board uses one.
- **F-45 Axes.** `x` grows to the right and `y` grows upward; rotations are counter-clockwise in
  degrees (DLR `<rotation>`, p. 111). KiCad writes negative `y` values for this reason.
*Amended (Q-I1-36):* the conversion rounds the plain float64 product to the nearest integer
(`1.005 × 1000 / 2 = 502.49999…` → 502).

## 5. Shapes

DLR `<shape_descriptor>` p. 117, `<rectangle_descriptor>` p. 100, `<circle_descriptor>` p. 15,
`<polygon_descriptor>` p. 97, `<path_descriptor>` p. 89, `<qarc_descriptor>` p. 100. A shape's
first item is a layer name; the reserved names `pcb` (every Sheet) and `signal` (every signal
Sheet) are accepted where section 6 says so.

- **F-50** `(rect L x1 y1 x2 y2)`: the axis-aligned rectangle with opposite corners `(x1,y1)` and
  `(x2,y2)` in either order.
- **F-51** `(circle L d [cx cy])`: the disk of diameter `d` centred at `(cx,cy)`, default
  `(0,0)`.
- **F-52** `(polygon L w x1 y1 … xn yn)`: the closed filled polygon through the vertices in order
  (the last vertex is joined to the first; a repeated closing vertex is dropped). The aperture
  width `w` is read and retained but the polygon's copper is the interior only (KiCad always
  writes `0`; the references ignore it). A polygon with fewer than three distinct vertices is
  *degenerate* and is treated as absent by whatever contains it (section 6, `D-24`).
- **F-53** `(path L w x1 y1 … xn yn)`: a polyline of `n ≥ 1` vertices stroked with a round
  aperture of width `w` (the union of the segments' capsules; a single vertex is a disk). A path
  whose vertices all coincide is a disk of diameter `w` when `w > 0` and degenerate otherwise.
  `(aperture_type square)` is retained in the document and ignored (no corpus board uses it).
- **F-54** `(polyline_path L w x1 y1 x2 y2 x3 y3 x4 y4 …)`: `2k` vertices define `k` infinite
  lines (each line through two consecutive vertices). The polyline's corners are the
  intersections of consecutive lines; it has `k − 1` corners and is stroked like a path of width
  `w`. Two consecutive lines that are parallel contribute the first vertex of the second line as
  the corner. Corners are rounded to LU after intersecting exactly (rational arithmetic).
  Example: lines `(78689.2,-140157.0)-(78689.1,-140157.0)`, `(78689.2,-140157.0)-(78689.2,-140156.9)`,
  `(0,-139031.7)-(-0.1,-139031.7)` give the corners `(78689.2,-140157.0)` and
  `(78689.2,-139031.7)`. Only router-written files use it (`Issue103-Board-Routed.dsn`,
  `Issue187-processor.Z80.dsn`, `Issue413-test.dsn`).
- **F-55** `(qarc …)` is not supported: the enclosing entry is dropped with diagnostic
  `shape-unsupported` (warning). No corpus board contains one.
- **F-56** `(window <shape>)` inside a keepout, plane or wiring polygon subtracts the shape from
  its parent (DLR `<window_descriptor>`, p. 140).
- **F-57 Layer name lookup** is an exact, case-sensitive match against the Sheet names (every
  layer reference in the corpus matches exactly; reference A additionally maps an unknown name
  containing `Top` or `Bottom` to the first or last Sheet, which no board needs). A shape whose
  layer name is neither a Sheet nor `pcb`/`signal` makes its entry dropped with diagnostic
  `layer-unknown` (warning).
*Amended (Q-I1-35):* a polygon with a positive aperture and fewer than three distinct vertices
is its stroked outline (a capsule), not degenerate.

## 6. `structure`

DLR `<structure_descriptor>`, p. 121.

### 6.1 Layers

- **F-60** `(layer NAME (type T) …)`: one Sheet per entry, in file order, index 0 first (DLR
  `<layer_descriptor>`, p. 51: "the first layer is the top physical layer"). `T = power` gives
  role `plane`; `signal`, `jumper`, `mixed`, an unknown type or a missing `type` give role
  `signal` (unknown: diagnostic `layer-type-unknown`). Reference A drops a layer of unknown type;
  no corpus board has one. `(property (index n))` is retained and ignored: the order in the file
  is the order of the Stack. `(use_net n…)`, `(rule …)` and `(direction …)` inside a layer are
  recorded on the layer entry.
- **F-61** Layer names are taken verbatim (Cyrillic and `#` included, `D-12`, `D-14`). Two layers
  with the same name: the second is dropped with diagnostic `layer-duplicate`.

### 6.2 Boundary

DLR `<boundary_descriptor>`, p. 13.

- **F-62** Every `(boundary <shape> …)` contributes its shapes; a boundary scope may hold several
  shapes and an optional `(clearance_class name)` (`D-15`), which names the Kind of the Rim.
- **F-63** A `rect` on layer `pcb` is the *bounding rectangle*. `path` and `polygon` shapes on
  `pcb` or `signal` are *outline rings* (a path's stroke width is ignored; its vertex ring is
  closed automatically). The Rim's outer ring(s) are the outline rings; when there are none, the
  Rim is the bounding rectangle. A `rect` on `signal` is also an outline ring.
- **F-64 Cut-outs.** An outline ring whose vertices all lie inside another outline ring is a
  cut-out (hole) of the Rim rather than a second outer ring.
- **F-65 Missing outline.** With no boundary shape at all, or when the bounding box of the
  boundary shapes has zero width and height, `readDsn` returns `ok: true` with
  `layout.rim = null` and the parse status `outline-missing` (diagnostic `outline-missing`,
  warning). A Layout without a Rim routes without a copper-to-edge rule.

### 6.3 Keepouts

DLR `<keepout_descriptor>`, p. 48. Semantics: `spec/rules/keepouts.md`.

- **F-66** `(keepout|via_keepout|wire_keepout|place_keepout|bend_keepout|elongate_keepout [NAME]
  <shape> {(window <shape>)} [(clearance_class K)] …)`. `NAME` is an optional bare or quoted
  name (an empty string means unnamed: `(keepout "" (circle F.Cu 4000 …))` in
  `Issue054-tairakb.dsn`, `D-29`); it is present when the item after the head is not a scope.
  `keepout` and `wire_keepout` are Fences of scope `track`; `via_keepout` scope `barrel`;
  `place_keepout` scope `place`; `bend_keepout` and `elongate_keepout` are retained in `other`
  and ignored. A keepout on layer `signal` is one Fence on every signal Sheet; on `pcb` one Fence
  on every Sheet (`D-21`: the references reject `pcb`); on a named layer one Fence on that Sheet.
- **F-67** A keepout whose shape is degenerate (F-52, F-53) is dropped with diagnostic
  `keepout-degenerate` (warning) — `D-24`.

### 6.4 Planes

DLR `<plane_descriptor>`, p. 97.

- **F-68** `(plane NET <shape> {(window <shape>)} [(clearance_class K)])` is a Pour owned by net
  `NET` on the shape's Sheet (the Sheet may be of either role: KiCad exports every zone as a
  plane). A `NET` that is not declared in `network` is created (with no pins). Hold is `locked`.

### 6.5 Vias, rules, control, angle, settings

- **F-69** `(via n1 n2 … [(spare m1 …)])` lists the padstack names available for routing, in
  order; spare names follow the regular ones (DLR `<via_descriptor>`, p. 138). Names are
  resolved per `padstack-names.md`; names that do not resolve are dropped with diagnostic
  `via-padstack-unknown` (warning). The resolved, de-duplicated list is `layout.viaRules[0]`
  (the default via rule) and the source of `library_out` in the session (`ses.md`).
- **F-70** `(rule …)` holds `(width w)` and `(clearance c [(type t)])` entries (`clear` =
  `clearance`); other entries are retained in `other`. Several `rule` scopes accumulate. The
  meaning of width, clearance and `type` (including class pairs `a_b`, single classes, object
  pairs `smd_smd`, `wire_via`, …) is `spec/rules/clearance.md`. In a `type` the pair may be
  spelled `a_b` or, in rules files, `"a"-"b"` (`rules.md` F-R12).
- **F-71** `(layer_rule L1 L2 … (rule …))` at structure level restricts the enclosed rules to the
  named Sheets (DLR `<layer_rule_descriptor>`, p. 53); `(layer L (rule …))` inside a layer entry
  has the same meaning for that Sheet.
- **F-72** `(control (via_at_smd on|off) …)`: `via_at_smd` is recorded; other control entries
  are retained in `other`. `(snap_angle ninety_degree|fortyfive_degree|none)` sets
  `layout.angleMode` to `90` / `45` / `any`; absent → `45` (`spec/api/settings.md`).
- **F-73** `(autoroute_settings …)` is read into `layout.settingsFromFile` per
  `spec/api/settings.md` with the keys `(fanout on|off)`, `(autoroute on|off)`,
  `(postroute on|off)`, `(vias on|off)`, `(via_costs n)`, `(plane_via_costs n)`,
  `(start_ripup_costs n)`, `(start_pass_no n)` (retained, ignored) and
  `(layer_rule L (active on|off) (preferred_direction horizontal|vertical)
  (preferred_direction_trace_costs x) (against_preferred_direction_trace_costs x))`. The
  misspellings `prefered_direction…` are accepted. Only router-written files carry this scope
  (`Issue103-Board-Routed.dsn`, `Issue187-processor.Z80.dsn`).
- **F-74** `(flip_style rotate_first|mirror_first)` at structure level, or inside
  `(place_control …)` in `placement`, selects the back-side transform of section 11; default
  `mirror_first` (DLR `<flip_style_descriptor>`, p. 38). Eagle writes it in the structure
  (`D-15`).
- **F-75** `(grid …)` entries are retained in `structure.other` and ignored (`D-16`).

## 7. `placement`

DLR `<placement_descriptor>` p. 96, `<component_instance>` p. 27, `<placement_reference>` p. 96.

- **F-80** `(component IMAGE {(place REF [x y SIDE ROT] …)})`: each `place` is a Part with
  reference `REF`, package `IMAGE` (the image name as written, F-90), location `(x, y)` in file
  units, `SIDE` `front` or `back` (any case; anything else is `front` with diagnostic
  `side-unknown`), rotation `ROT` in degrees counter-clockwise (any real; stored as read and
  reduced modulo 360 into `[0, 360)` for the Layout). A `place` with no coordinates is an
  *unplaced* Part: retained in the document, absent from the Layout.
- **F-81** Inside `place`: `(PN text)` is the part number (bare or quoted; a bare `7`, `\`, `,`,
  `[` or `.` is a valid part number, `D-9`); `(lock_type position …)` marks the Part's position
  as fixed; `(pin NAME (clearance_class K))`, `(keepout NAME (clearance_class K))` and the
  `via_keepout` / `place_keepout` forms assign a Kind to that Pad or image keepout; anything else
  is retained in `other`.
- **F-82** The same `REF` placed twice: the second is dropped with diagnostic `part-duplicate`.
  A `component` whose `IMAGE` has no image definition yields Parts with no Pads and diagnostic
  `image-unknown` (warning).

## 8. `library`

DLR `<library_descriptor>` p. 58, `<image_descriptor>` p. 43, `<padstack_descriptor>` p. 74.

### 8.1 Images

- **F-90** `(image NAME …)` defines a package. `NAME` is taken verbatim, including any `::N`
  suffix KiCad appends to distinguish footprint variants; images are never merged or renamed
  (`D-23`: both references merge same-named images whose pins coincide and re-number the rest).
  Two images with the same name: the second is dropped with diagnostic `image-duplicate`.
- **F-91** `(pin PADSTACK [(rotate R)] NAME x y [(rotate R)])`: a pin of the image with
  padstack reference `PADSTACK` (resolved per `padstack-names.md`), pin name `NAME` (F-7),
  offset `(x, y)` relative to the image origin, and rotation `R` degrees counter-clockwise
  (default 0; `(rotate 1e-07)` is a rotation of 10⁻⁷ degrees, `D-8`). The `rotate` scope may
  precede the pin name (KiCad) or follow the coordinates (DLR). A pin whose padstack does not
  resolve is dropped with diagnostic `padstack-unknown` (warning). Two pins of one image with the
  same name are both kept (they are distinct Pads).
- **F-92** `(outline <shape>)` entries are the image outline (DLR `<outline_descriptor>`, p. 73;
  the layer is ignored). They are retained in the document and are not Layout items (no corpus
  case needs placement rules).
- **F-93** `(keepout|via_keepout|wire_keepout|place_keepout [NAME] <shape> …)` inside an image
  is a Fence attached to every Part of the image, transformed like its pins (section 11); its
  layer is a Sheet name, `signal` or `pcb` as in F-66. An unnamed image keepout gets the name
  `keepout_<k>` / `via_keepout_<k>` / `place_keepout_<k>`, `k` counting from 1 per image and
  kind, so that `place` entries (F-81) can refer to it.
- **F-94** `(side front|back|both)` is recorded on the image and has no effect on geometry
  (only `front` occurs in the corpus).

### 8.2 Padstacks

- **F-95** `(padstack NAME {(shape <shape> …)} [(attach on|off [(use_via v)])] [(absolute on|off)]
  [(rotate on|off)] …)` defines a PadForm. `NAME` is normalised for lookup but kept as spelled
  (`padstack-names.md`). Each `shape` scope holds one shape on one layer; a shape on `pcb` or
  `signal` is placed on every Sheet. Shapes on the same layer accumulate (a PadForm's copper on a
  Sheet is the union of its shapes there). A shape's coordinates are relative to the padstack
  origin. `attach off` sets `attachAllowed = false` (default `true`); `absolute on` keeps the
  padstack's layer order on back-side Parts (F-114). Other entries (`rotate`, `rule`, …) are
  retained in `other`.
- **F-96** A padstack with no shape at all is dropped with diagnostic `padstack-empty` (warning).
  A shape that has no area (a zero-width path, a zero-diameter circle, a collapsed rectangle) is
  dropped from the padstack with diagnostic `padstack-shape-degenerate`; reference A enlarges such
  a shape by one LU instead (`D-25`).
- **F-97** Duplicate definitions: a second padstack whose normalised name equals an earlier one's
  is dropped with diagnostic `padstack-duplicate` (warning), even when its shapes differ
  (`D-28`: KiCad 5 writes distinct custom pads under one name).
- **F-98** Pad copper is the exact shape (polygons may be concave). Reference A replaces a
  concave pad polygon by its convex hull; a router may do the same as a conservative
  approximation for routing, but DRC measures the exact shape (`D-26`).

## 9. `network`

DLR `<network_descriptor>` p. 69, `<net_descriptor>` p. 67, `<class_descriptor>` p. 17,
`<class_class_descriptor>` p. 17, `<circuit_descriptors>` p. 15, `<layer_rule_descriptor>` p. 53,
`<fromto_descriptor>` p. 40. Semantics: `spec/rules/nets.md`, `spec/rules/clearance.md`,
`spec/rules/vias.md`.

- **F-100** `(net NAME [SUBNET] …)`: `NAME` is a bare lexeme or quoted string (F-7: `1`,
  `" 1"` and `~{WAIT}` are names); an integer directly after the name is the subnet number
  (default 1; router-written files carry it). Contents: `(pins ref…)` or `(order ref…)`,
  `{(fromto ref ref …)}`, `(rule …)`, `{(layer_rule …)}`, `(circuit …)`; anything else retained.
  `(pins)` may be empty. The same `NAME` with the same subnet number appearing twice merges
  pins (diagnostic `net-duplicate`). A net named by the empty string is kept as a net with name
  `""` (it can hold pins; KiCad never gives it pins).
- **F-101** Pin references (F-9, DLR `<pin_reference>`, p. 93) are `COMPONENT-PIN`. The text of
  a `pins` / `order` / `fromto` entry is the concatenation of its adjacent lexemes (F-9), and it
  is split at the *first* `-` that is not inside a quoted segment; quotes around either part are
  removed. Examples: `U1-1` → (`U1`, `1`); `SW1-A'` → (`SW1`, `A'`); `B1--` → (`B1`, `-`);
  `"FP-Altair1"-1` → (`FP-Altair1`, `1`); `"J1"-"D+"` → (`J1`, `D+`); `u1-1e31` → (`u1`,
  `1e31`); `U18--` → (`U18`, `-`). An entry with no `-` is dropped with diagnostic
  `pin-reference-malformed`. A reference to a Part or pin that does not exist is dropped with
  diagnostic `pin-unknown` (warning).
- **F-102** `(class NAME net… (circuit …) (rule …) (clearance_class K) (via_rule V)
  {(layer_rule …)} …)`: a NetGroup named `NAME` containing the listed nets (bare or quoted
  names). An empty-string net name in the list is ignored (`D-27`: KiCad 8 writes `""` first);
  a class name may be the empty string (`(class "" …)`) or the bare two-character name `''`
  (`D-17`, `(class '' …)`). `circuit` holds
  `(use_via padstack…)` and `(use_layer layer…)`; other circuit entries (`length`, `priority`,
  …) are retained. A net listed in two classes belongs to the last one (diagnostic
  `net-in-two-classes`); a net listed in no class belongs to the default group named `default`
  (created when absent; `spec/rules/nets.md`). A class with the name `default` supplies the
  default group's rules.
- **F-103** `(class_class (classes a b …) (rule …) {(layer_rule …)})` defines pairwise rules
  between the listed NetGroups. `(via_rule NAME via…)` in `network` defines a named via rule.
  Semantics in `spec/rules/vias.md` and `spec/rules/clearance.md`; the document keeps them
  verbatim (section 13).

## 10. `wiring`

DLR `<wiring_descriptor>` p. 145, `<wire_shape_descriptor>` p. 143, `<wire_via_descriptor>`
p. 144.

- **F-110** `(wire <shape> [(net NAME [SUBNET])] [(type T)] [(clearance_class K)]
  {(window <shape>)} …)`: with a `path` or `polyline_path` shape it is a Track on the shape's
  Sheet with the path's width; with a `polygon`, `rect` or `circle` shape it is a Pour with the
  listed windows as holes. The net is the named net (all subnets of that name when no subnet
  number is given); a wire without `net`, or whose net does not exist, is kept as an item with
  `net = null` (an obstacle that connects nothing). A path with fewer than two distinct vertices
  is dropped with diagnostic `wire-degenerate` (warning). Consecutive coincident vertices are
  collapsed. A wire whose layer is not a Sheet is dropped (F-57).
- **F-111** `(via PADSTACK x y [(net NAME [SUBNET])] [(type T)] …)`: a Barrel at `(x, y)` with
  the resolved PadForm spanning the Sheets on which the PadForm has a shape (first to last). An
  unresolved padstack drops the via with diagnostic `padstack-unknown`. Several coordinate pairs
  after the padstack name (allowed by the DLR) are several Barrels.
- **F-112 Hold.** `type` maps to Hold: `fix` → `locked`; `protect`, `route` and any other value
  → `held`; `normal`, `shove_fixed` or no `type` → `free`. A `locked` file item is never written
  to a session (`ses.md` F-S43); a `held` one is written with `(type protect)`; a `free` one
  without `type`. (KiCad 5 writes `protect` for every track, KiCad 6+ `route`, KiCad writes
  `fix` for locked tracks and expects them to stay out of the session; `Issue753-CPU-85_r104.dsn`
  has only `fix` wiring and its unrouted session therefore has an empty `network_out`.)

## 11. Pad placement geometry

Observable pad positions for a pin `p` of image `I` at offset `(px, py)` with pin rotation `r`
and padstack `S`, placed by `(place REF cx cy SIDE R)`:

- **F-113 Front side.** Each shape of `S` is rotated by `r` degrees counter-clockwise about the
  pin origin, translated by `(px, py)`, rotated by `R` degrees counter-clockwise about the image
  origin, and translated by `(cx, cy)`. The Pad's centre is `(cx, cy) + rot(R)·(px, py)`. The
  padstack's shape on layer index `i` lands on Sheet `i`.
- **F-114 Back side, `mirror_first` (default).** The pin offset and every shape are first
  mirrored across the image's Y axis (`x → −x`), then rotated by `R` counter-clockwise, then
  translated by `(cx, cy)`: centre `(cx, cy) + rot(R)·(−px, py)`. The padstack's shape on layer
  index `i` lands on Sheet `n − 1 − i` (`n` = number of Sheets) unless the padstack is
  `absolute on`, in which case it stays on Sheet `i`.
- **F-115 Back side, `rotate_first`.** Rotation by `R` is applied first and the mirror across
  the Y axis afterwards: centre `(cx, cy) + mirror(rot(R)·(px, py))`, i.e. `(cx − (px cos R −
  py sin R), cy + px sin R + py cos R)`. Layer flip as in F-114.
- **F-116** Rotations that are multiples of 90° are exact on integer coordinates; other
  rotations are computed in floating point and rounded to LU (F-43).
- **F-117** Image keepouts (F-93) are transformed exactly like pins. Image outlines are not
  Layout items.

Example (`Issue035-ReadPlaceScope.dsn`, `um`, 10): `(place R3 255905 -63890 back 270)` with
pin `1` at offset `(-1025, 0)` sits at `(255905, -63890) + rot(270°)·(1025, 0) =
(255905, -64915)` and pin `2` at offset `(1025, 0)` at `(255905, -62865)`; their padstack
shape, defined on `F.Cu` (index 0 of 2), lands on `B.Cu`. Both references place them there.

## 12. Diagnostics and parse status

- **F-120** `readDsn` returns `ok: true` for every input that has the header of F-20; the parse
  status reported in `spec/acceptance/parse/*.json` is `ok`, or `outline-missing` (F-65), and
  `parse-error` only for F-20 failures.
- **F-121** Diagnostic codes used above: `stray-close`, `unclosed-scope`, `string-spans-lines`,
  `duplicate-section`, `unknown-scope`, `structure-missing`, `malformed-<head>`,
  `unit-in-section`, `layer-type-unknown`, `layer-duplicate`, `layer-unknown`,
  `outline-missing`, `keepout-degenerate`, `via-padstack-unknown`, `shape-unsupported`,
  `side-unknown`, `part-duplicate`, `image-unknown`, `image-duplicate`, `padstack-unknown`,
  `padstack-empty`, `padstack-shape-degenerate`, `padstack-duplicate`, `net-duplicate`,
  `pin-reference-malformed`, `pin-unknown`, `net-in-two-classes`, `wire-degenerate`. Levels:
  `info` for `string-spans-lines` and `unknown-scope`, `warning` otherwise. Every diagnostic
  carries `where.line` when it stems from a lexeme.

## 13. Document model

`DsnDocument` is the file-shaped DTO returned by `readDsn` and accepted by `writeDsn`. All
numbers are in file units exactly as read (no rounding, no unit conversion); all names are
strings exactly as spelled (quotes removed, padstack names *not* normalised); every scope that
this model has no field for is kept as an `SExpr` in the nearest `other` list, in file order, so
that `writeDsn` can reproduce it. `SExpr` is `{ head: string; items: Array<SExpr | string |
number>; line?: number }` where a `number` item is one whose lexeme was of kind `number` and
whose value round-trips (`F-6`); any lexeme used as a name is a `string`.

```ts
export type DimensionUnit = "inch" | "mil" | "cm" | "mm" | "um";
export type DocLayerRef = string;            // a Sheet name, or the reserved "pcb" / "signal"

export type DocShape =
  | { kind: "rect"; layer: DocLayerRef; x1: number; y1: number; x2: number; y2: number }
  | { kind: "circle"; layer: DocLayerRef; diameter: number; cx: number; cy: number }
  | { kind: "polygon"; layer: DocLayerRef; aperture: number; pts: number[] }        // x0 y0 x1 y1 …
  | { kind: "path"; layer: DocLayerRef; width: number; pts: number[]; apertureType?: "round" | "square" }
  | { kind: "polyline_path"; layer: DocLayerRef; width: number; pts: number[] }     // 2 vertices per line
  | { kind: "qarc"; layer: DocLayerRef; width: number; pts: number[] };             // retained, unsupported

export type DocRuleEntry =
  | { kind: "width"; value: number }
  | { kind: "clearance"; value: number; type?: string }     // the type scope's text as written, quotes kept: "smd_smd", "\"default\"-\"1A EXTERNAL 1oz\"" (rules.md F-R12 interprets it)
  | { kind: "other"; raw: SExpr };

export interface DocLayerRule { layers: string[]; rules: DocRuleEntry[] }

export interface DocParser {
  stringQuote: string;                 // default "\""
  spaceInQuotedTokens: boolean;        // default false when absent
  hostCad?: string; hostVersion?: string;
  present: boolean;                    // false when the file has no parser scope
  other: SExpr[];                      // constant, write_resolution, case_sensitive, via_rotate_first, generated_by_*
}

export interface DocLayer {
  name: string; type: string;          // "signal" | "power" | "jumper" | "mixed" | other spelling as read; "" when absent
  useNets: string[]; rules: DocRuleEntry[]; direction?: string; other: SExpr[];
}
export interface DocBoundary { shapes: DocShape[]; clearanceClass?: string; other: SExpr[] }
export interface DocKeepout {
  kind: "keepout" | "via_keepout" | "wire_keepout" | "place_keepout" | "bend_keepout" | "elongate_keepout";
  name?: string; shape: DocShape; windows: DocShape[]; clearanceClass?: string; other: SExpr[];
}
export interface DocPlane { net: string; shape: DocShape; windows: DocShape[]; clearanceClass?: string; other: SExpr[] }
export interface DocAutorouteLayerRule {
  layer: string; active?: boolean; preferredDirection?: "horizontal" | "vertical";
  preferredDirectionTraceCosts?: number; againstPreferredDirectionTraceCosts?: number; other: SExpr[];
}
export interface DocAutorouteSettings {
  fanout?: boolean; autoroute?: boolean; postroute?: boolean; vias?: boolean;
  viaCosts?: number; planeViaCosts?: number; startRipupCosts?: number; startPassNo?: number;
  layerRules: DocAutorouteLayerRule[]; other: SExpr[];
}
export interface DocStructure {
  layers: DocLayer[]; boundaries: DocBoundary[]; keepouts: DocKeepout[]; planes: DocPlane[];
  vias: string[]; spareVias: string[];
  rules: DocRuleEntry[]; layerRules: DocLayerRule[];
  control: { viaAtSmd?: boolean; other: SExpr[] };
  snapAngle?: "ninety_degree" | "fortyfive_degree" | "none";
  flipStyle?: "rotate_first" | "mirror_first";
  autorouteSettings?: DocAutorouteSettings;
  other: SExpr[];                      // grid, place_rule, unit/resolution (F-44), unknown scopes
}

export interface DocPlace {
  ref: string; x?: number; y?: number; side?: "front" | "back"; rotation?: number;
  partNumber?: string; lockType?: string[];
  pinClearance: Array<{ pin: string; clearanceClass: string }>;
  keepoutClearance: Array<{ kind: "keepout" | "via_keepout" | "place_keepout"; name: string; clearanceClass: string }>;
  other: SExpr[];
}
export interface DocComponent { image: string; places: DocPlace[]; other: SExpr[] }
export interface DocPlacement { components: DocComponent[]; flipStyle?: "rotate_first" | "mirror_first"; other: SExpr[] }

export interface DocPin { padstack: string; name: string; x: number; y: number; rotation: number; other: SExpr[] }
export interface DocImage {
  name: string; side?: "front" | "back" | "both"; pins: DocPin[]; outlines: DocShape[];
  keepouts: DocKeepout[]; other: SExpr[];
}
export interface DocPadstackShape { shape: DocShape; other: SExpr[] }   // reduced_shape, connect, window retained
export interface DocPadstack {
  name: string; shapes: DocPadstackShape[]; attach: boolean; attachUseVia?: string;
  absolute: boolean; other: SExpr[];
}
export interface DocLibrary { images: DocImage[]; padstacks: DocPadstack[]; other: SExpr[] }

export interface DocPinRef { component: string; pin: string }
export interface DocCircuit { useVia: string[]; useLayer: string[]; other: SExpr[] }
export interface DocNet {
  name: string; subnet: number;        // subnet default 1
  pins: DocPinRef[]; ordered: boolean; // ordered = written with `order`
  fromtos: DocPinRef[][];
  rules: DocRuleEntry[]; layerRules: DocLayerRule[]; circuit?: DocCircuit; other: SExpr[];
}
export interface DocClass {
  name: string; nets: string[];        // "" entries dropped (F-102)
  circuit?: DocCircuit; rules: DocRuleEntry[]; layerRules: DocLayerRule[];
  clearanceClass?: string; viaRule?: string; other: SExpr[];
}
export interface DocClassClass { classes: string[]; rules: DocRuleEntry[]; layerRules: DocLayerRule[]; other: SExpr[] }
export interface DocViaRule { name: string; vias: string[]; other: SExpr[] }
export interface DocNetwork { nets: DocNet[]; classes: DocClass[]; classClasses: DocClassClass[]; viaRules: DocViaRule[]; other: SExpr[] }

export interface DocWire {
  shape: DocShape; windows: DocShape[]; net?: string; subnet?: number; type?: string;
  clearanceClass?: string; other: SExpr[];
}
export interface DocWireVia { padstack: string; points: number[]; net?: string; subnet?: number; type?: string; other: SExpr[] }
export interface DocWiring { wires: DocWire[]; vias: DocWireVia[]; other: SExpr[] }

export interface DsnDocument {
  name: string;                        // the pcb name token, "" when absent or empty
  parser: DocParser;
  resolution: { unit: DimensionUnit; perUnit: number; present: boolean };
  unit: { unit: DimensionUnit; present: boolean };
  structure: DocStructure;
  placement: DocPlacement;
  library: DocLibrary;
  network: DocNetwork;
  wiring: DocWiring | null;            // null when the file has no wiring scope
  other: SExpr[];                      // any other top-level scope, in file order
}
```

Field conventions: `present` flags distinguish "absent" from "default" so that `writeDsn` does
not invent scopes; optional fields are omitted (not `undefined`-valued) when absent so that
deep-equality is well defined; every `other` array is present (possibly empty).

## 14. Round trip

- **F-ROUNDTRIP** For every board that reads with status `ok` or `outline-missing`,
  `readDsn(writeDsn(readDsn(t).document)).document` deep-equals `readDsn(t).document`. `writeDsn`
  quotes a name with the document's quote character when the name is empty, contains a
  separator, a parenthesis, the other quote character or any of `; - _ / ~ { }`, or would
  otherwise lex as a number (F-6) or begin with a quote character; a name that contains the
  document's quote character is written with that character removed (no escape exists, and the
  other quote character does not quote, F-4; `ses.md` F-S30 does the same). It
  writes numbers in the shortest decimal form that reproduces the value (`1e-7` for `1e-07`,
  `15.75`, `-2050`) and retained `SExpr`s verbatim. Nothing else about the written text is
  specified.
