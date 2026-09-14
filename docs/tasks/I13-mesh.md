# Task I13 — M10a: the Mesh (coarse global grid), Bridge capacities, congestion report

Role: implementer. Write set: `src/route/`, `test/`. This milestone COMMITS NO COPPER and changes
NO routing behaviour — `globalPlan` stays `"off"` and every acceptance number must be byte-identical.
R-1 is trivially safe (nothing is inserted).

Read `docs/DESIGN.md` §10 (esp. §10.2, §10.5), `spec/glossary.md` (Mesh/Bin/Bridge/Overflow/Corridor/
Plan terms and the global-routing literature: Nair, Kastner/Labyrinth, FastRoute, BoxRouter),
`spec/api/settings.md` (the `global*` settings), and `src/route/{clear,journal}.ts`, `src/lattice/`,
`src/layout/`, `src/drc/connect.ts`.

## Deliverables

1. **`src/route/mesh.ts`** — build a per-Sheet coarse global grid (Mesh) over the Layout bounding
   box: `buildMesh(layout, lattice, {binUm?})`. `binLu` derived from the densest NetGroup's track
   pitch so the Mesh is ~30–120 bins across (deterministic; `globalBinUm` overrides). Expose `Bin`
   ids `(sheet, bx, by)`, `binOf(sheet, p)`, `centreOf(bin)`, `bridgesOf(bin)` (4 in-plane + inter-
   Sheet via edges), and per-Bridge `capacity` / `usage` / `present` / `history` accessors.
2. **Capacities from fixed blockage (R-2 baked in)**: a Bridge's `capacity` = the number of
   width+spacing tracks that fit across the Bin boundary AFTER subtracting fixed blockage — pads,
   `held`/`locked`/`origin:"prior"` copper, fences, rim, plane obstruction — queried via
   `Lattice.hits`. `free` other-net copper does NOT reduce capacity. Round capacity DOWN
   (conservative). Deterministic.
3. **Congestion / overflow report**: `meshCongestion(mesh)` → per-Bridge overflow and a board
   summary (max/total overflow, most-congested Bins), for diagnostics and later phases.
4. **Tests** (`test/mesh.test.ts`): capacity matches a brute-force track-count on synthetic blockage;
   a fully-blocked Bridge has capacity 0; determinism (two builds identical); a congestion report on
   a small board. Plus an **invariance test**: `route()` with `globalPlan:"off"` produces byte-
   identical output (assert against the existing perf-invariance fingerprints or add a mesh-off case).

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; `globalPlan:"off"` leaves all acceptance
numbers unchanged (no route change); `src/route/README.md` gains a Mesh paragraph; `src/QUESTIONS.md`
updated. Commit with implementer trailers.
