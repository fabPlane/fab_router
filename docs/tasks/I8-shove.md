# Task I8 — M9a: push-and-shove and stronger negotiated congestion

Role: implementer. Write set: `src/route/`, `src/geom/` (an offset helper only if needed),
`test/`. Build on the existing router; extend, do not rewrite.

Read `docs/DESIGN.md` §9 and §9a in full, `spec/glossary.md` (design from the cited literature:
Dai/Kong/Sato shove, McMurchie & Ebeling present+history congestion, Dees & Karger rip-up,
Nair difficulty ordering, Nash et al. Theta*), `spec/api/contract.md` (R-1, R-2, R-5, R-6),
`spec/api/settings.md`, `spec/behaviour/scenarios/shove.md` (once S9 lands it — the outcome
scenarios you must satisfy), and the current `src/route/{passes,ripup,nudge,clear,journal}.ts`.

## Deliverables

1. **`src/route/shove.ts`** — `shoveClear(layout, lattice, journal, sheet, seg, profile, ignore,
   {windowLu, maxDepth, maxMoved}) → boolean`: make `seg` clear by displacing the movable
   (`isRippable`) free other-net Tracks blocking it perpendicular to themselves by the minimum
   distance that clears it, keeping their endpoints fixed, re-checking each reshaped Track with the
   exact `sweepClear`, cascading to movable neighbours up to `maxDepth`/`maxMoved`, and rewinding
   the whole trial through the Journal on any infeasibility (immovable blocker, slack past
   `windowLu`, budget). R-1 and R-2 hold by construction; a shoved net stays as complete as before
   (endpoints fixed).
2. **Present-congestion term** in `src/route/ripup.ts`: add a per-pass present-usage count on the
   resource cell and make the soft-step cost `(startRipupCost + h·histWeight)·(1 + pn·presentWeight)`;
   reset present each pass, keep history across passes.
3. **Difficulty ordering** in `src/route/passes.ts`: route connections in descending
   (airline × local congestion) order, ties `(net, id)`, gated by `orderByDifficulty`.
4. **Ladder wiring**: add a shove rung (`tryShoveRoute`) before rip-up in `routeConnection`, and
   prefer shoving a movable blocker over ripping it in the soft-search commit path.
5. **Settings** in `spec/types/settings.ts` is NOT in your write set — the orchestrator has added
   `shoveEnabled`, `shoveWindowUm`, `shoveMaxDepth`, `shoveMaxMoved`, `presentCongestionCost`,
   `orderByDifficulty` there; wire them through `resolveSettings`/the pass loop. Default them so the
   FAST tier's behaviour and timing do not regress.
6. **Tests** (`test/shove.test.ts`): shove opens a blocked channel where rip-up alone does not; a
   shoved net's `incomplete` is unchanged; locked/held/Prior copper is never moved; R-1 holds
   (`checkDrc` clean after a shove); cascade terminates.

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; `bun run acceptance -- --tier all
--case 'routing-*'` shows **measurable completion gains** on the movable-congestion boards
(cm5-carrier, green14seg, bm01, dent bm07) with `violations.maxAdded: 0` still hard everywhere and
no regression on any currently-passing case; turn advisory completion bounds hard where you now
reach them. Record per-board before/after in `src/QUESTIONS.md`. Commit with implementer trailers.
