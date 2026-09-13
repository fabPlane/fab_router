# Observed DSN dialects

Entries `D-nn` are written by the formats task (S1). Entries `D-S2-nn` below were found while
reconciling the parse summaries (`spec/acceptance/parse/`) and are owned by the rules task (S2);
they are appended here so that every dialect ruling lives in one file.

## From S2

Each entry: *observed input* → *required interpretation* → *boards where it occurs* → *what the
two references did and why the ruling was made*. The parse summary of every board listed records
the ruling in its `notes`.

### D-S2-01 — a `plane` scope makes its net a plane net

*Observed input.* `(plane GND (polygon B.Cu 0 …))` inside `structure`, on a board whose layers are
all `(type signal)`; or a `(layer X (type power) (use_net N))` layer.

*Required interpretation.* The net named by a `plane` scope, or by a power layer's `use_net`
list, is a **plane net** (`nets[].plane: true` in the parse summary; `spec/rules/layers.md`
L-06). The Pour itself is inserted on the named Sheet, locked (`hold: "locked"`), owned by that
net.
A net named only by a `plane` scope and by no `net` scope is still created (with zero Pads).

*Boards.* 34 boards, e.g. `Issue015-StackOverflow.dsn` (GND), `Issue367-Charger.dsn` (9 nets),
`cm5-carrier.dsn` (4 nets), `Issue230-CNH_Functional_Tester_1.dsn` (GND, on two power layers),
`Issue756-tomu-fpga.dsn` (6 nets).

*References.* Reference A marks the net as a plane net whenever a `plane` scope names it;
reference B marks only nets listed by a power layer's `use_net`, so it marks none of the 34
boards' nets. Ruling: A — the SPECCTRA reference defines `plane` as "a power plane for the named
net" (Design Language Reference, `structure` / `plane`), and the flag is what turns on the
plane-via cost and the "reached the Pour, done" completion rule (`spec/rules/connectivity.md`
K-07); the set of plane nets is exactly the set of nets named by `plane` scopes or power-layer
`use_net` lists on every corpus board, so no area heuristic is needed.

### D-S2-02 — via padstack list without repeats

*Observed input.* The structure `(via "V1" "V2")` list plus every class's `(circuit (use_via V1))`
plus network `(via …)` definitions naming the same padstacks.

*Required interpretation.* `viaPadstacks[]` is the ordered union in first-mention order — the
structure list first, then each class's `use_via` names in file order, then padstacks named only
by network `via` definitions — with every repeated name dropped.

*Boards.* 116 boards (every KiCad export with a `use_via` list), e.g. `Issue026-J2_reference.dsn`
(listed twice by reference A, once in the ruling).

*References.* Reference A concatenates the lists and keeps repeats; reference B keeps distinct
names. Ruling: B — repeats carry no information, and Barrel candidates are chosen per via rule,
never from this list directly.

### D-S2-03 — the via rule made from a class's `use_via` is named after the class as written

*Observed input.* `(class kicad_default … (circuit (use_via "Via[0-1]_800:400_um")))` with no
`via_rule` scope in the file.

*Required interpretation.* Reading such a class creates a via rule named `kicad_default` (the
class name as written) holding the listed padstacks in list order, and assigns it to the default
NetGroup (`kicad_default` *is* the default group, `spec/rules/nets.md` N-05). The rule created
when the file has no `via_rule` scope at all is named `default` and is created first
(`spec/rules/vias.md` V-03).

*Boards.* 106 boards — every KiCad export.

*References.* Reference A names the class-derived rule `default` (because it has already merged
the class into the default group); reference B keeps `kicad_default`. Ruling: B — the name is
then the one the file uses, and the two rules stay distinguishable in the summary.

### D-S2-04 — `use_via` names with fractional dimensions resolve like the structure `via` list

*Observed input.* `(padstack "Via[0-1]_685.8:330.2_um" …)` in the library and
`(circuit (use_via Via[0-1]_685.8:330.2_um))` in a class.

*Required interpretation.* Padstack references in `use_via` lists are normalised with the same
rule as padstack definition names and the structure `via` list (`spec/formats/padstack-names.md`):
the fractional parts are dropped, so the reference resolves to the PadForm `Via[0-1]_685:330_um`
and the class's via rule contains it. A `use_via` name that resolves to no PadForm is skipped
with a diagnostic; if that leaves the rule empty the NetGroup has no Barrel candidates.

*Boards.* 13 boards: `Issue015-StackOverflow.dsn` (6 class rules), `Issue022-AutoRouter_interrupted.dsn`,
`Issue027-zMRETestFixture.dsn`, `Issue029-hw48na.dsn`, `Issue208-router.dsn`,
`Issue230-CNH_Functional_Tester_1.dsn` (and its copy `Issue230-CNH_Functional_Tester-CNH_Functional_Tester_1.dsn`), `Issue555-CNH_Functional_Tester_1.dsn`,
`Issue756-tomu-fpga.dsn`, `-fpga7`, `-fpga8`, `-fpga9`, `-fpga11`.

*References.* Reference A normalises the structure `via` list but compares `use_via` names
verbatim, leaving those class via rules empty (the nets of such a class then route without
Barrels); reference B normalises both. Ruling: B — the file plainly names the padstack it
defined; an empty rule would silently forbid vias for the whole class.

### D-S2-05 — `image` names with a `::n` suffix are kept as written

*Observed input.* `(image Capacitor_SMD:C_0805_2012Metric …)` and
`(image Capacitor_SMD:C_0805_2012Metric::1 …)` — the exporter writes a second image with a `::n`
suffix when a footprint is used with different pad variants; the two may or may not have
identical pins. `(component Capacitor_SMD:C_0805_2012Metric::1 (place C3 …))` refers to the
suffixed image.

*Required interpretation.* Both images are PadForm/pin definitions in their own right and a
Part's `package` is the name exactly as its `component` scope writes it (`components[].package`
in the parse summary). Pin resolution uses the named image; a component naming an image that does
not exist but whose base name (suffix removed) does exist uses the base image.

*Boards.* 10 boards: `Issue066-Project_GP8B.dsn` (24 parts), `Issue102-Mars-64-revE-rot00.dsn`,
`Issue326-Mars-64-revE.dsn`, `Issue555-BBD_Mars-64.dsn`, `Issue575-drc_BBD_Mars-64_6_track_1_hole_clearance_violations.dsn`,
`Issue593-BBD_Mars-64.dsn`, `Issue689-BBD_Mars-64.dsn`, `Issue153-wavefolder.dsn`,
`Issue178-KeebMaker_Sofle_Choc.dsn`, `Issue283-UnconnectedTracesUnderPads-Natural_Tone_Preamp.dsn`.

*References.* Reference A merges a suffixed image into the base image when their pins are
identical and reports the base name; reference B keeps every image and reports the name as
written. Ruling: B — no geometry differs either way, and the file's own name is the one a session
writer or a diagnostic should echo.
