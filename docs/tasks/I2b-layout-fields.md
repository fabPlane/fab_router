# Task I2b — populate the new Layout fields; move DR-11 predicates to geom

Role: implementer. Write set: `src/dsn/`, `src/layout/`, `src/ses/`, `src/drc/`, `src/geom/`,
`src/route/`, `test/`.

Read `spec/types/layout.ts` (`Layout.file`, `Part.locked`, `Track.origin`/`Barrel.origin`,
`Fence.part`) and `spec/api/contract.md` rulings Q-I2-47, Q-I2-54, Q-I2-59, Q-I2-60.

1. I1's builder (`src/layout/build.ts`) populates `Layout.file` (unit, perUnit, quote, hostCad,
   hostVersion from the document), `Part.locked`, and `Fence.part` for image keepouts. `writeSes`
   then reads `Layout.file` instead of the attached document (keep the attachment as a fallback).
2. Set `origin` on file wiring (`"file"`) in the builder and on session items (`"session"`) in
   `applySes`; `writeSes` with `includeFileWiring: false` writes only `origin === "router"`.
3. Move `crossesEdge` / `withinRim` to `src/geom` (Q-I2-59); `src/route/clear.ts` and
   `src/drc/exact.ts` import the single copy. `bun run check:layers` must stay green.
4. Keep every currently-passing case passing; `bun run typecheck`, `check:layers`, `test` green.
   Update `src/QUESTIONS.md`. Commit with implementer trailers.
