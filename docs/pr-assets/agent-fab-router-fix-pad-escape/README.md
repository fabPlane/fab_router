# Opposite-terminal pad escape evidence

Engine source commit: `f7378c5`, based on main `69cf598`. The independent source change is seven lines in the local connection driver. The complete candidate native sweep captured main HEAD before the source commit was created; all 74 source hashes were subsequently verified against the committed source. No engine source edits occurred during the sweep.

- `benchmark-summary.json`: complete native before/after comparison, 26 identical cases × 3 seeds, all source hashes and per-case outcomes/median geometry. Controls match. Passing attempts 39→48, valid cases 13→16, opens 120→60, new errors 27→21. No case gains opens/errors or loses passing status.
- `regression-results.json`: minimized geometry, both terminal id orders, 3 repeats per version. Original order completes 0/3→3/3; reverse order stays 3/3; zero engine violations throughout.
- `corpus-results.json`: Issue026 J2, 3 repeats per version. Incompletes 2→1, vias 34→37, track length 478.867→514.967 mm, zero engine violations. This measured intentional route change accounts for the one updated fingerprint. Explicit completion/DRC assertions were added; determinism remains checked.
- `pad-escape.svg` and `.png`: simplified native copper/pad render, fan-controller J2-small, seed 3. Other copper is grey; the affected net is orange. Source board licence retained in `LICENSE`.
- `compare.py`, `regressions.ts`, `render.py`: reproduction tools. Each documents its arguments. Run the renderer with system Python containing KiCad's `pcbnew` and `rsvg-convert`.

Validation: typecheck and layers pass; 863 unit tests pass, 0 fail, 398538 assertions (231.19 seconds). Initial full run found only the intentional fingerprint change; the final complete run includes the updated fingerprint and stronger completion/DRC checks.

Native before/after came from the same shared Linux host and cores 20–25, frozen inputs/settings/checker/runtime, seeds/order. Tests and other agents overlapped the measurements. Median route seconds 1.172079→1.116479 is descriptive, not an isolated speed claim. Completing routes can increase vias/length. Already passing LCR J3 adds 1.545 mm while removing 2 vias; nextbusclock J2-large adds 2.573 mm with unchanged vias. Native thermal starvation remains unresolved (21 summed errors). No general native DRC guarantee is claimed.
