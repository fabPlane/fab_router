# Vias: via definitions, via rules and Barrels

Clauses `V-nn`. Observable through `Layout.viaRules`, `Layout.barrels`, `Layout.padForms` and the
parse summaries (`viaPadstacks[]`, `rules.viaForms[]`, `rules.viaRules[]`, `counts.vias`).

## PadForms usable for Barrels

**V-01 — the via PadForm list.** The PadForms a router may instantiate as Barrels are, in order
and without repeats: the structure `(via P1 P2 …)` list, then each class's `(circuit (use_via …))`
names in file order, then any PadForm named by a network `(via …)` definition not yet listed
(D-S2-02). Every name is resolved with the padstack reference normalisation of
`spec/formats/padstack-names.md` (fractional dimension parts dropped, D-S2-04); a name that
resolves to no PadForm is dropped with a diagnostic. A PadForm's **span** is the range from the
first Sheet to the last Sheet on which it has a shape; a Barrel is *through* if the span covers
Sheet 0 to the last Sheet, *blind* if it reaches exactly one of the two outer Sheets, *buried*
otherwise. `LayoutStats.barrels.{through,blind,buried}` count Barrels by their PadForm's span.

**V-02 — via definitions (`viaForms`).** `(via NAME PADSTACK [KIND] [attach])` in `network`
defines a named via: PadForm `PADSTACK`, Kind `KIND` if it names an existing Kind, else
`default`, and `attach: true` if the token `attach` is present. If the file has no via
definitions at all, one is created per via PadForm, named like the PadForm, with the default
group's `barrel` Kind, and with attach allowed iff the structure `(control (via_at_smd on))` is
present **and** the PadForm does not say `(attach off)`.

**V-03 — via rules.** `(via_rule NAME V1 V2 …)` in `network` creates the via rule `NAME` whose
candidate list is the via definitions `V1, V2, …` in that order (their PadForms are the Barrel
candidates in that order). If any `Vi` names no via definition the whole rule is discarded with a
diagnostic. A second `via_rule` with the same name replaces the first. If the file has **no**
`via_rule` scope that survives, a rule named `default` is created first: for each distinct span
(fromSheet, toSheet) among the via definitions carrying the default group's `barrel` Kind it
holds the definition with the smallest pad extent on the span's first Sheet, in file order of
first appearance of each span. Every NetGroup's via rule is then the first rule in the list
unless N-06 assigns another.

**V-04 — `use_via`.** A class with `(circuit (use_via P1 P2 …))` gets its own via rule, named
after the class as written (`kicad_default` for the KiCad default class, D-S2-03), holding — in
list order — every via definition whose PadForm is `Pi` (after normalisation) and whose Kind is
the class's `barrel` Kind. That rule is appended after the rules of V-03 and becomes the group's
via rule. A `use_via` list that yields no candidates leaves the group with an empty rule: the
router then adds no Barrel for that group's nets.
*Amended (Q-I1-33):* a class's `use_via` rule is appended even when a rule of that name exists.

**V-05 — classes with their own clearance.** A class other than the default group whose `rule`
carries a `clearance` (C-08) gets, for every via PadForm of V-01, a via definition named
`<PadForm>-<class>` with the class's `barrel` Kind (attach as in V-02); the parse summary's
`viaForms` lists them after the file's own definitions. If that class has no `use_via`, it
also gets a rule named after the class built like the `default` rule of V-03 but from those
definitions. (Observed on `Issue015-StackOverflow.dsn`: definitions `Via[0-1]_600:300_um-1A
EXTERNAL 1oz` … and rules `1A EXTERNAL 1oz`, `2.5A EXTERNAL`, ….)

**V-06 — candidate order is binding.** When the router needs a Barrel for a connection of group
G it tries G's via rule's candidates in order and uses the first one whose PadForm spans the two
Sheets being joined (a candidate spanning more Sheets than needed is acceptable) and fits
(`spec/rules/drc.md`). Blind and buried candidates are used only when their span covers exactly
the Sheets needed or when no through candidate fits.

## Barrels in the file

**V-07 — `wiring` vias.** `(via PADSTACK x y (net N) (type T) [(clearance_class K)])` in
`wiring` is a Barrel at (x, y) with PadForm `PADSTACK` (normalised), net N (or `null` if absent
or unknown), Kind K if given else its group's `barrel` Kind, and Hold from T: `fix` → `locked`,
`normal` or absent → `free`, anything else (`route`, `protect`, `shove_fixed`, …) → `held`.
`counts.vias` in the parse summary is the number of such Barrels; a via naming an unknown
PadForm is skipped with a diagnostic (not counted).

**V-08 — attach.** A Barrel may be placed so that its copper overlaps a same-net SMD Pad only if
its via definition allows attach (V-02). Otherwise a Barrel and a same-net Pad whose copper
overlap on a Sheet, or whose drills coincide, are a spacing violation candidate for the router's
own placement (the router must not create that overlap) but **not** a DRC violation at load
(`spec/rules/drc.md` DR-03): the file's own via-in-pad test points are legal.

**V-09 — vias disabled.** With `viasAllowed: false` the router adds no Barrel (R-4 in
`spec/api/contract.md`); Barrels present in the file stay and still connect. A connection whose
two ends have no common usable Sheet then stays incomplete. Fanout is a no-op under
`viasAllowed: false`.

**V-10 — Barrels and plane Sheets.** A Barrel whose span covers a plane Sheet owned by another
net is allowed (the CAD tool clears the plane around it); a Barrel of the plane's own net
reaching that Sheet is connected to the plane (`spec/rules/connectivity.md` K-06). A Barrel is
never *placed* on a plane Sheet as its endpoint Sheet (plane Sheets are not usable, L-04).

## Reference observations

The two references disagreed only on the naming and resolution of class via rules (D-S2-03,
D-S2-04) and on repeats in the via PadForm list (D-S2-02). Reference A leaves 13 corpus boards'
class via rules empty because it compares `use_via` names verbatim; the spec resolves them
(V-01), so on those boards the reference-A routing numbers in `spec/acceptance/reference/` were
produced with fewer Barrel candidates than the spec grants.
