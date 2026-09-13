# `src/layout` — design model

The Layout and everything in it (`docs/DESIGN.md` §2, vocabulary in `spec/glossary.md`): Stack of
Sheets, PadForms, Parts, Pads, Barrels, Tracks, Pours, Fences, Rim, Nets, NetGroups, the
SpacingTable and via rules — plain data with stable integer ids and no object pointers, so the
Journal and snapshots stay trivial. Semantics come from `spec/rules/*.md` (clearance Kinds and pair
types, plane Sheets, keepout scoping, fixed wiring). This task provides the concrete SpacingTable
(dense symmetric matrix per Sheet and pair type) and an empty-Layout constructor; the DSN reader
task builds Frames, pad instantiation and rule resolution on top. No literature beyond the
SPECCTRA Design Language Reference (Cadence 2003) for what the file means.
