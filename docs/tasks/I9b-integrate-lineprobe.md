# Task I9b — integrate the line-search router (I9) onto the shove router (I8)

Role: implementer. Write set: `src/route/`, `test/`.

The line-search detailed router (task I9) was built on a base that predates the shove router
(task I8, now on `main`), so its `src/route/passes.ts` change to the `routeConnection` strategy
ladder conflicts with I8's shove rung. Everything else in I9 is a clean add.

The finished I9 work is at the git tag **`i9-work`**. Do this:

1. Bring in I9's clean-add files unchanged from that tag:
   `git checkout i9-work -- src/route/lineprobe.ts test/lineprobe.test.ts`
   (and take the `src/route/index.ts` export line for `lineprobe` if `main` lacks it).
2. Re-apply I9's `routeConnection` change to the CURRENT `src/route/passes.ts` (which already has
   I8's shove rung): add `tryLineprobeRoute` as the **last** rung, after grid A* + shove + rip-up +
   nudge, gated on `detailedRouter !== "off"` and tried only on late passes (≥2) or
   previously-failed connections, under the `detailedBudgetMs`/`detailedMaxTiles` caps, inserting
   via `insertLayeredTrail` (so R-1/R-2 hold). Compare `git show i9-work -- src/route/passes.ts`
   to see exactly what I9 added, and keep BOTH the shove rung and the lineprobe rung.
3. Also merge I9's `src/QUESTIONS.md` additions (union is fine).

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green (incl. `test/lineprobe.test.ts` 5/5);
`bun run acceptance -- --tier all --case 'srj-*'` still 4/4 hard; no regression on any routing
case; the shove rung and the lineprobe rung both present in `routeConnection`. Commit with
implementer trailers.
