# Padstack names: normalisation, resolution, and what a name tells about the drill

Padstack references occur in five places: `pin` entries of images (`dsn.md` F-91), the
structure `via` list (F-69), `use_via` lists of classes (F-102), `via` entries of `wiring`
(F-111) and of sessions (`ses.md` F-S62), and the `via` / `padstack` entries of rules files
(`rules.md` F-R14, F-R15). All of them resolve by the rules below. Clauses are `P-nn`.

- **P-1 Normalised form.** The *normalised form* of a name is the name with every occurrence
  of a `.` followed by one or more decimal digits removed (`.` + digits, anywhere, repeatedly),
  then compared case-insensitively. Examples:

  | as written | normalised form |
  |---|---|
  | `Via[0-1]_685.8:330.2_um` | `Via[0-1]_685:330_um` |
  | `Via[0-1]_1541.78:1186.18_um` | `Via[0-1]_1541:1186_um` |
  | `RoundRect[T]Pad_875x950_219.582_um` | `RoundRect[T]Pad_875x950_219_um` |
  | `RoundRect[A][600,0]Pad_2600x1600.2_401.572_um_0.000000_0` | `RoundRect[A][600,0]Pad_2600x1600_401_um_0_0` |
  | `Round[A]Pad_1320.800000_um` | `Round[A]Pad_1320_um` |
  | `RoundRect[T]Pad_3199.9935999999993x1599.9967999999997_um` | `RoundRect[T]Pad_3199x1599_um` |
  | `Round1$13.779528` | `Round1$13` |
  | `via-0.5:auto-1.0:auto-tht` | `via-0:auto-1:auto-tht` |
  | `V_600.0` | `V_600` |
  | `p38e5`, `Via[0-1]_600:300_um` | unchanged |

- **P-2 Resolution.** A reference resolves to the PadForm whose normalised form equals the
  reference's normalised form. Every reference position uses this rule; there is no position
  where the raw spelling is compared. (Reference A compares the raw spelling for `use_via`
  entries in classes and for rules-file `via` entries, which is why decimal-bearing names fail
  to resolve there; reference B normalises `use_via` but not rules-file vias. Ruling: normalise
  everywhere.)
- **P-3 Corpus coverage.** In the corpus every reference's raw spelling also matches a
  definition's raw spelling, so P-2 changes nothing for image pins, structure via lists and
  wiring vias; it matters for the rules files (`rules.md` F-R15) and for boards from other
  sources (a benchmark board outside the corpus spells one via `…812.8_um` in one place and
  `…812_um` in another).
- **P-4 Unresolved.** A reference that resolves to nothing produces the diagnostic named in the
  clause that reads it (`padstack-unknown`, `via-padstack-unknown`) and the entry is dropped:
  the pin, the via-list entry, the wiring via, the rules-file via. A class whose `use_via` list
  resolves to nothing keeps the default via rule (`spec/rules/vias.md`).
- **P-5 First definition wins.** When two padstack definitions have the same normalised form,
  the first one read defines the PadForm and the second is dropped with diagnostic
  `padstack-duplicate` — whether or not their shapes differ, and whether the second comes from
  the design file or a rules file. This collapses `Via[0-1]_1541.78:1186.18_um` and
  `Via[0-1]_1541.8:1186.18_um` (`Issue015-StackOverflow.dsn`) and the two
  `RoundRect[A][600,0]Pad_2600x1600…` variants (`Issue209-split05.dsn`) into one PadForm each;
  the pins that referenced the second definition get the first's shapes (`dsn-dialects.md`
  D-28). Both references keep the first definition. Ruling: same, because a later definition
  that differs only in decimals is the same pad to the CAD tool that wrote it.
- **P-6 Names kept.** A PadForm's name is the spelling of its first definition, untouched. It is
  the name written to sessions (`ses.md` F-S34, F-S44) so that a CAD tool re-importing the
  session sees the drill it exported (P-10). The references store and write the normalised
  form instead (`Via[0-1]_1541:1186_um`); the corpus reference sessions therefore carry
  normalised names, which P-2 resolves.
- **P-7 Parse summaries.** `spec/acceptance/parse/*.json` are expected to list `padstacks` and
  `viaPadstacks` by normalised form (that is what both references report); the count of PadForms in a Layout
  equals the count of distinct normalised forms among the definitions that have at least one
  shape.
- **P-10 Drill from the name.** A design file gives no drill diameter, so a PadForm's hole is
  inferred from its name, which KiCad and LibrePCB encode: if the name contains `:`, take the
  text after the first `:` up to the next `_` (or the end) and keep only digits and dots — that
  is the drill diameter `d`; take the text between the last `_` before the `:` and the `:`,
  digits and dots only — that is the outer diameter `o`. When both parse and `o > 0`, the hole
  radius is `r × d / o` where `r` is the smallest half-extent of the PadForm's shapes over its
  Sheets (`min(width, height) / 2` of each shape's bounding box, minimum over Sheets).
  Otherwise the hole radius is `0.45 × r`. Examples: `Via[0-1]_800:400_um` with a 800 µm circle
  → hole radius 200 µm; `Via[0-3]_635:304.8_um` → `r × 304.8 / 635`;
  `via-0.5:auto-1.0:auto-tht` (LibrePCB) → `d` parses as `1.0` (from `auto-1.0:auto-tht`) but
  there is no `_` before the `:`, so there is no outer diameter and the hole radius is
  `0.45 × r`. A PadForm with no `:` in its name (`Round[A]Pad_1524_um`,
  `Oval[A]Pad_2286x1524_um`, `p887`) also gets `0.45 × r`. Whether a PadForm has a hole at all (a
  through Pad versus an SMD Pad) is decided by its Sheets, not its name: `spec/rules/vias.md`
  and `spec/rules/drc.md` (hole clearance).
