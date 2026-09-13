# `src/layout` — design model

The Layout and everything in it (`docs/DESIGN.md` §2, vocabulary in `spec/glossary.md`): Stack of
Sheets, PadForms, Parts, Pads, Barrels, Tracks, Pours, Fences, Rim, Nets, NetGroups, the
SpacingTable and via rules — plain data with stable integer ids in one id space (contract ruling
Q-I3-15) and no object pointers.

| Module | Contents |
|---|---|
| `model.ts` | `LayoutX`: the concrete Layout (a structural subtype of `spec/types/layout.ts`) with per-category Kinds and per-Sheet widths of NetGroups, subnet numbers and plane flags of Nets, Fence owners, via definitions, normalised padstack names; the back-side Pad convention (mirror, rotate, translate — Q-I3-17) |
| `spacing.ts` | the mutable SpacingTable (`spec/rules/clearance.md`): Kinds in creation order, per-Sheet symmetric values, C-07 row copying |
| `units.ts` | Frame choice (dsn.md F-43, clearance.md C-04) and the LU rounding rules for coordinates, spacings and widths |
| `shapes.ts` | DocShape → ShapeOnSheet in LU, rigid transforms for pad placement, polyline_path corners (F-54, exact rational intersection), ring cleaning and degeneracy tests |
| `rules.ts` | the rule engine shared by the DSN builder and the rules overlay: Kinds and pair types (C-03 … C-13, rules.md F-R12), NetGroups from classes (nets.md), via definitions and rules (vias.md V-01 … V-05), item Kinds (C-11) |
| `build.ts` | `DsnDocument` → `LayoutX` in the order Frame → Sheets → PadForms → Parts/Pads/Part Fences → Nets → planes → NetGroups and SpacingTable → vias → wiring → board Fences and Rim → item Kinds → settings |
| `summary.ts` | the normalised parse summary of `spec/acceptance/parse/README.md` |
| `index.ts` | the I0 SpacingTable factory and empty-Layout constructor (kept for tests and stubs) |

No literature beyond the SPECCTRA Design Language Reference (Cadence) for what the file means.
