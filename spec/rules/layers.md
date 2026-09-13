# Sheets: the Stack, plane Sheets, active Sheets, preferred direction

Clauses `L-nn`. Observable through `Layout.stack`, the parse summaries (`layers[]`,
`nets[].plane`, `rules.netGroups[].inactiveSheets`), `LayoutStats` and routing results.

**L-01 — the Stack is the file's.** The Sheets are the `layer` scopes of `structure` in file
order; Sheet index = position in that order (0-based). The `(property (index n))` sub-scope is
ignored for ordering. The layer count is always the file's: no Sheet is ever added or removed
by reading, by settings (an inactive Sheet is still a Sheet), or by routing. `layers[]` in the
parse summary is the Stack.

**L-02 — roles.** `(type power)` → role `plane`. `(type signal)`, `(type jumper)`, or no `type`
→ role `signal`. A `layer` with any other `type` word is not a Sheet: it is dropped with a
diagnostic and later Sheets close the gap in the index (no corpus board has one; every corpus
layer is `signal` or `power`).
*Amended (Q-I1-34):* an unknown layer `type` is kept as a signal Sheet (F-60 governs).

**L-03 — Sheet names are exact.** Names are matched as written (after quote removal) when
shapes, rules, keepouts and wiring refer to them; a reference to a name that is no Sheet and is
not a pseudo-layer (`signal`, `pcb`) is a diagnostic and the referring item is dropped (Fences
KO-03; a `wire` on an unknown layer is dropped, a `padstack` shape on an unknown layer is
dropped from the PadForm). Two Sheets may not share a name; if they do, references resolve to
the first.

**L-04 — plane Sheets are not routable.** No Track may be placed on a plane Sheet by the router;
every NetGroup's usable Sheets exclude plane Sheets (`inactiveSheets` lists them in the parse
summary, e.g. `Route2` on `Issue145-smoothieboard.dsn`, `In1.Cu`/`In2.Cu` on
`Issue230-CNH_Functional_Tester_1.dsn`). Tracks the *file* places on a plane Sheet are read,
kept, counted and written back; they are reported as a diagnostic (the CAD tool's own DRC
regards them as errors) but not as a Violation.

**L-05 — plane Sheets carry copper.** For each plane Sheet: every `plane` scope naming that
Sheet is a Pour of its net on it. If a plane Sheet names nets in `(use_net …)` but the file
gives no Pour on it, a Pour covering the whole board bounding box, owned by the first `use_net`
net, with Kind `null` and `hold: "locked"`, is added (so `counts.pours` on `Issue230-CNH_Functional_Tester_1.dsn`
counts the two `plane GND` scopes; a board with `use_net` but no `plane` gets one synthetic Pour
per such Sheet). A plane Sheet with neither is empty copper: a diagnostic, nothing else.

**L-06 — plane nets.** A net is a *plane net* (`nets[].plane: true`; `Net` flag observable
through the settings-dependent via cost, `spec/api/settings.md` `planeViaCost`, and the
completion rule K-07) iff a `plane` scope names it or a power Sheet's `use_net` lists it.
Ruling D-S2-01. `Sheet.planeNet` of a plane Sheet is the first `use_net` net, or the net of its
only `plane` scope, or unset if it has neither or several.

**L-07 — what a plane Sheet blocks.** A Pour on a plane Sheet, like every Pour, is **not** an
obstacle to Tracks or Barrels of other nets (`spec/rules/connectivity.md` K-05: the CAD tool
re-pours around routed copper); since no Track can be placed on a plane Sheet (L-04) the only
copper the router adds to a plane Sheet is the Barrel body of a Barrel spanning it (V-10).
Ruling reason: both references treat Pours as non-obstacles and let other-net through-Barrels
cross plane Sheets; forbidding that would make every 4-layer KiCad board with `In1.Cu`/`In2.Cu`
planes unroutable without blind vias.

**L-08 — inactive Sheets from settings.** `settings.layers[name].active = false` removes the
Sheet from every NetGroup's usable set for the run (the Sheet stays in the Stack, its items stay
obstacles and stay connected). A signal Sheet that is inactive for every group behaves like a
plane Sheet for routing purposes. A `use_layer` list (N-06) intersects with the active set: a
group may only use Sheets that are both listed and active. `Issue230-CNH_Functional_Tester_1.dsn`
is the corpus board whose routing case turns a signal Sheet off (`spec/acceptance/cases/`).

**L-09 — preferred direction.** Each Sheet has a preferred direction used only as a routing
cost (`preferredDirectionCost`): default **vertical on even Sheet indices, horizontal on odd
ones** (Sheet 0 vertical, Sheet 1 horizontal), overridden per Sheet by an
`autoroute_settings (layer_rule NAME (preferred_direction horizontal|vertical))` scope in the
file (when `useFileSettings` is on) or by `settings.layers[name].preferDir`. It never changes
what is legal, only what is cheap; `Sheet.preferDir` reports the effective value.
*Amended (Q-I1-39):* `Sheet.preferDir` is `null` at read time unless the file sets it; the
router applies the default of `spec/api/settings.md` (longer side first, alternating).

**L-10 — SMD side.** A PadForm with copper on exactly one Sheet is SMD; placed on a back-side
Part its copper lands on the mirrored Sheet (Sheet index `count − 1 − i`), so an SMD Pad of a
`back` Part on a two-Sheet board is on Sheet 1. `LayoutStats.fanout.smdPads` counts SMD Pads that have a
net; `escaped` counts those that are connected (`spec/rules/connectivity.md` K-01..K-06)
directly to a Track or a Pour, or to a Barrel that is itself connected to a Track or a Pour.

## Reference observations

Both references produce the same Stack on every corpus board (`layers[]` identical in every
parse summary). The plane-net flag is the one disagreement (D-S2-01). Reference A applies a
heuristic that promotes an inner all-signal-stack Sheet carrying no Tracks and a Pour covering
more than half the board to a plane Sheet for routing purposes; reference B applies it only when
the file has no `plane` scope; on every corpus board the outcome equals L-06, so the spec has no
such heuristic.
