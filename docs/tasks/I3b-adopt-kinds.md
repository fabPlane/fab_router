# Task I3b — adopt the contract changes from rulings Q-I3-15…25

Role: implementer. Write set: `src/route/profile.ts`, `src/route/clear.ts`, `src/lattice/`,
`test/clear-vs-drc.test.ts`, `test/lattice.test.ts`, `test/helpers/synth.ts`.

Read `spec/api/contract.md` "Rulings on implementer questions" (Q-I3-*), `spec/types/layout.ts`
(`Fence.kind`, `NetGroup.categoryKinds`, `ViaRule.entries`, the one-id-space note),
`spec/rules/drc.md` DR-06a and DR-11, `spec/rules/clearance.md` C-15 ruling.

1. Make `bun run typecheck` green: populate the new fields in the synthetic Layouts, use
   `categoryKinds` (Track/Barrel Kinds) and `ViaRule.entries[].kind` / `.attach` in
   `resolveProfile`, use `Fence.kind` in `clear.ts`.
2. Implement DR-11 in `sweepClear` / `barrelFits` (copper must stay inside the Rim's outer ring
   and outside cut-outs) and DR-06a (drill span + drill-to-drill); extend
   `test/clear-vs-drc.test.ts`'s brute-force oracle accordingly.
3. If `checkDrc` is real in this checkout (I2 landed), also assert
   `checkDrc(layout).violations` against the oracle as your question 24 proposed.

Done when typecheck, layers and `bun run test` are green; update `src/QUESTIONS.md`. Commit with
implementer trailers.
