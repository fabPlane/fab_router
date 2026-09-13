# Fences (keepouts)

Clauses `KO-nn`. Observable through `Layout.fences`, `counts.fences` and `keepouts[]` in the
parse summaries, and `checkDrc` (`rule: "fence"`).

**KO-01 — three scopes.** `keepout` → Fence scope `track`; `via_keepout` → scope `barrel`;
`place_keepout` → scope `place`. A `track` Fence forbids Track copper **and** Barrel copper of
every net inside it; a `barrel` Fence forbids Barrel copper only (Tracks may cross it); a
`place` Fence forbids nothing the router does (it constrains Part placement, which this router
never changes) and never produces a violation, but it is kept, counted in `counts.fences`, and
written back unchanged. `wire_keepout` is a synonym of `keepout` (`Issue754-avionics_hub.dsn`
has one, on Sheet `Ground`); the other SPECCTRA keepout keywords (`bend_keepout`,
`elongate_keepout`) are unknown scopes, skipped with a diagnostic (no corpus board uses them).
Syntax is in `spec/formats/dsn.md`.

**KO-02 — where they come from.** Structure-level scopes give board-owned Fences (`owner:
board` in the summary). `keepout`/`via_keepout`/`place_keepout` scopes inside an `image` are
instantiated for every Part placed with that image, transformed with the Part (rotation, side
mirroring) like its pins (`owner: part`). A Part-owned Fence follows the Part's side: an image
Fence on Sheet `F.Cu` of a back-side Part lands on the mirrored Sheet, exactly as a pin's copper
does.

**KO-03 — Sheet scoping.** The Fence's shape names a layer. A real Sheet name → one Fence on
that Sheet. The pseudo-layer `signal` → one Fence per **signal** Sheet (plane Sheets excluded;
`Layout.fences[].sheet` may be `"all-signal"` for it, but `counts.fences` counts the
materialised Fences: a `signal` keepout on a board with four signal Sheets is 4). The
pseudo-layer `pcb` (SPECCTRA: "every layer") → the Fence is **dropped with a diagnostic**; so
is a layer name that matches no Sheet. Ruling: reference A refuses the whole file on a `pcb`
keepout and reference B drops it with a warning; the spec follows B because the file must still
read, and an all-Sheet Fence invented from an ambiguous name would block routing outright. No
corpus board carries a `pcb`-layer keepout (`polygon signal` occurs on 115 keepouts, per-Sheet
circles on the rest).

**KO-04 — shapes.** `rect`, `circle`, `polygon` and `path` (a stroked path, width ≥ 0) are all
valid Fence shapes; a `path` of width 0 with two points is a degenerate segment. A Fence whose
shape has no area — all vertices identical, a zero-radius circle, a zero-width single-point path
(the KiCad 4.0.7 export defect) — is **dropped with a diagnostic** and not counted; the board
reads successfully and routing is merely less constrained. Observed on boards exported by old
KiCad versions (`Issue029-hw48na.dsn` carries degenerate wires; see `spec/formats/dsn-dialects.md`
for the boards with degenerate keepouts).

**KO-05 — Kind.** A Fence carries the default group's `area` Kind unless its scope names a
`clearance_class`; an unknown class name gives Kind `null` (C-11), which makes the Fence a hard
wall with no spacing around it. With a non-null Kind, copper must keep `spacing(kind(Fence),
kind(item))` away from the Fence's edge, not merely stay outside it.

**KO-06 — nets and Fences.** A Fence has no net. (`Layout.fences[].net` is reserved for the
SRJ adapter's net-owned obstacles, `spec/formats/srj.md`; a DSN Fence never sets it.) Copper of
every net, including Pads and file wiring, is subject to a `track`/`barrel` Fence in DRC;
a Pad or held Track inside a Fence in the file is a pre-existing violation (DR-05).

**KO-07 — hole Fences.** The CAD tool exports a non-plated hole as a Part-owned circular
`keepout` per copper Sheet (`Issue575-drc_BBD_Mars-64_6_track_1_hole_clearance_violations.dsn`,
`(keepout "" (circle F.Cu 3200))` in the `MountingHole` images). With `holeClearanceUm` set,
these Fences take the `hole_edge` Kind of C-15; otherwise they are ordinary `track` Fences of the
`area` Kind.

**KO-08 — Hold.** Every Fence has `hold: "locked"`; the router never moves or removes one.

## Reference observations

Both references materialise identical Fence counts per (scope, Sheet, owner) on every corpus
board (the `keepouts[]` field of every parse summary was identical between them).
`Issue039-bug-design.dsn` (56 board-owned `barrel` Fences on `F.Cu`) and
`Issue732-RoyalBlue54L-Feather.dsn` are the only boards with `barrel` Fences; no corpus board
has a `place` Fence; 33 boards have board-owned Fences and most KiCad exports have Part-owned
ones (mounting holes).
