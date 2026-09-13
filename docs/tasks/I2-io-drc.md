# Task I2 — session writer/reader, DRC, connectivity, statistics

Role: implementer. Write set: `src/ses/`, `src/drc/`, `src/api.ts` (bodies of `writeSes`,
`applySes`, `checkDrc`, `layoutStats`, `requiredConnections`), `test/`.

Read first: `docs/DESIGN.md` §3, §5, `spec/glossary.md`, `spec/api/contract.md`,
`spec/types/{layout,results}.ts`, `spec/formats/ses.md`, `spec/rules/{clearance,connectivity,drc,
keepouts,layers,vias}.md`, `spec/acceptance/README.md`, the `ses-roundtrip-*`, `ses-apply-*`,
`drc-*` cases under `spec/acceptance/cases/`, `spec/acceptance/ses/README.md`,
`spec/acceptance/reference/` (the `applied-ses` profile files). I0 and I1 are on `main`.

## Deliverables

1. **Session writer** (`src/ses/write.ts`): `writeSes(layout, opts)` per `ses.md` F-S1…F-S63,
   plus the canonical normaliser `normaliseSes(text) → tree` the `ses-roundtrip` cases compare
   with (`F-S50`). Every `ses-roundtrip-*` case passes.
2. **Session reader** (`src/ses/apply.ts`): `applySes(layout, text)` with the replacement
   semantics of `ses.md`; every `ses-apply-*` case passes.
3. **Connectivity** (`src/drc/connect.ts`): union-find per net over the joins of
   `connectivity.md` K-01…K-12 (physical copper overlap, Pours connect, plane Sheets, terminal
   components); `requiredConnections` = Kruskal MST over terminal components with the tie-break of
   `docs/DESIGN.md` §5; `incompletes`.
4. **Clearance DRC** (`src/drc/spacing.ts`): `drc.md` DR-01…DR-10 — pair types, same-net
   exemption (DR-02), Rim / copper-to-edge, hole clearance, Fences, pair dedup; `Violation` records
   with `at`, `required`, `actual`, `rule`. Build on the Lattice from `src/lattice/` if I3 has
   landed on `main`; otherwise a straightforward per-Sheet sweep is acceptable for this task and I3
   will replace the candidate search.
5. **Statistics** (`src/drc/stats.ts`): `layoutStats` with every field of `LayoutStats`
   (`spec/api/contract.md` table, including the fanout definitions).
6. Wire the API bodies. Every `drc-*` case passes; the `applied-ses` reference numbers are
   reproduced by `applySes` + `checkDrc` + `layoutStats` on those boards (write
   `test/applied-ses.test.ts` over `spec/acceptance/reference/*.applied-ses.json`).

## Done when

`bun run typecheck`, `bun run check:layers`, `bun run test` green; `bun run acceptance -- --tier
all --case 'ses-*'` and `--case 'drc-*'` all pass; `src/ses/README.md`, `src/drc/README.md`
written; `src/QUESTIONS.md` updated. Commit with implementer trailers.
