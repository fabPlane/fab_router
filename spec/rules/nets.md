# Nets, Pads, subnets and NetGroups

Clauses `N-nn`. Observable through `Layout.nets`, `Layout.netGroups`, `Layout.pads[].net` and
the parse summaries (`nets[]`, `rules.netGroups[]`). Syntax: `spec/formats/dsn.md`.

## Nets and pins

**N-01 — a net is a name plus a subnet number.** `(net NAME (pins …))` creates the net
`NAME` with subnet 1. A net scope may carry an integer before its first sub-scope
(`(net NAME 2 (pins …))`); that integer is its subnet number. Two scopes with the same name and
subnet number are one net: the second scope's pin list replaces the first's. Net names are
compared exactly (case-sensitive, spelling as written after quote removal).

**N-02 — pin references.** Each entry of `pins`, `order` or `fromto` is `<part ref>-<pin name>`,
split at the **first** hyphen (`J2-A13` → Part `J2`, pin `A13`; `U1-A-1` → Part `U1`, pin
`A-1`). A reference whose Part or pin does not exist is ignored with a diagnostic; the net is
still created. A Pad named by no net has `net: null`; it keeps its Kind and remains an obstacle
to every net.

**N-03 — subnets.** `(fromto A-1 B-2)` scopes inside a net create one subnet per scope, numbered
upward from the net's subnet number, each containing exactly the two named pins. An `(order
A-1 B-2 C-3)` list creates the chain of two-pin subnets (A-1,B-2), (B-2,C-3), … . A net with
neither has a single subnet holding its whole `pins` list. Each subnet is a separate Net in the
Layout (same `name`, different `subnet`) with its own connections; the parse summary lists
`subnet` only when it is not 1. No corpus board uses `fromto` or `order`.

**N-04 — nets that exist without a `net` scope.** A net named by a `plane` scope or by a power
layer's `use_net` list (`spec/rules/layers.md` L-06) exists with zero Pads if no `net` scope
declares it. A name that appears only in a `class` net list (KiCad writes `""` for the pads with
no net there) creates nothing.

**N-05 — the default NetGroup.** Every Layout has NetGroup index 0 named `default`; every net
belongs to it unless a `class` scope lists the net. A class named `default` or `kicad_default`
(case-insensitive) **is** the default group: its rules apply to the default group and its nets
stay in it; the parse summary reports such nets without a `group` field. Any other class name
creates a NetGroup of that name (once; a second scope with the same name adds to it).
A net listed by two classes ends in the last one read.

**N-06 — what a NetGroup carries** (and how the summary reports it):

| Attribute | Source | Default when absent |
|---|---|---|
| `trackWidth` per Sheet (`width`, `widthBySheet`) | `(rule (width W))`; `(layer_rule L (rule (width W)))` for one Sheet | the default group's width; the default group's own default is the structure `rule` width, or 3000 LU if the file has none |
| `kind` (Track Kind) | C-08 when the class rule has a clearance; `(clearance_class K)` names an existing Kind explicitly | `default` |
| item-category Kinds (`itemKinds`) | C-08 / C-09 | inherited from the default group at creation |
| `viaRule` | `(via_rule NAME)` naming a rule defined by a `via_rule` scope; else `(circuit (use_via …))` (V-04); else, for a class with its own clearance, the class's default rule (V-05) | the default group's via rule |
| usable Sheets (`inactiveSheets` lists the complement) | `(circuit (use_layer L1 L2 …))`: exactly the listed Sheets are usable | every signal Sheet; plane Sheets are never usable (L-04) |
| `minLength` / `maxLength` | `(circuit (length MAX MIN))` — a maximum and a minimum total Track length for each net of the group | none (0 = unlimited). No corpus board sets them |
| `shoveFixed`, `pullTight` | `(shove_fixed on)`, `(pull_tight off)` | off, on |

A `(net NAME (rule (width W)))` inside a `net` scope moves that net into a NetGroup that is a
copy of the default group with width W (an unnamed group; reuse an existing group with identical
width, Kind and via rule rather than creating another).

**N-07 — `ignoreNetGroups`.** With `ignoreNetGroups: [G1, …]` (from settings or the `-inc`
style option), the router attempts no connection whose net is in a listed group; those nets'
items stay on the board as obstacles. `layoutStats` / `checkDrc` count their connections in
`connections.maximum` and `connections.incomplete` unless `StatsOptions.ignoreNetGroups` lists
the group, in which case those nets contribute to neither. Group names are matched exactly
against NetGroup names as reported (so `kicad_default` names the default group per N-05).

**N-08 — the per-connection Profile.** For a connection of net n in group G, the width is G's
width on the Sheet being routed, the spacing vector is row `kind(G)` of the SpacingTable, the
Barrel candidates are G's via rule in order (V-02), the usable Sheets are G's, and the angle mode
is the Layout's. Nothing outside G and the Layout influences the Profile.

## Reference observations

Both references produce the same nets, pin counts and NetGroup attributes on every corpus board
(the parse summaries' `nets[]` and `rules.netGroups[]` fields agreed on all 148 readable boards,
apart from the via-rule name recorded as D-S2-03 and the plane flag recorded as D-S2-01).
