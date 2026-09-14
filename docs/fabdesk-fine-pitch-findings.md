# fab_router on the fabdesk fine-pitch fanout cases (2026-09-15)

The fabdesk board runs (`tensorfleet/fabdesk/docs/{desktop-mobile-board-run,router-issues}.md`) show
the router currently wired into fabdesk — `@tscircuit/capacity-autorouter` behind a SimpleRouteJson
adapter — failing DRC on every board with a fine-pitch part: it inflates pad boxes, drops the
inflation to 0 nm when 0.5 mm-pitch pads overlap, lands trace centrelines on neighbouring pads, and
**reports "all connections routed"** — 8–26 clearance / shorting / edge / crossing violations per
board (router-issues.md R1/R2/R3/R5), non-deterministically, and on coarse/large boards it times out
or wedges the bridge (R6/R7/R8).

## What fab_router does on the same geometry

Fine-pitch fanout fixtures were generated from the standard KiCad footprint geometry
(`tools/fabdesk-cases/gen-finepitch.ts`; `spec/acceptance/boards/fabdesk-{qfn28,usbc}-fanout.srj.json`)
and routed with `routeSrj` (`tools/fabdesk-cases/measure.ts`):

| board | nets | completed | violations added | vias |
|---|---|---|---|---|
| QFN-28 0.5 mm + 0603 fanout | 14 | 12 | **0** | 0 |
| USB-C 0.5 mm 16-pin + 0603 fanout | 6 | 2 | **0** | 0 |

**The headline: zero added DRC violations, by construction.** fab_router never inserts a trace that
fails the exact clearance predicate (invariant R-1), and it reports a net it cannot route within the
rules as *incomplete* — never as routed. That is precisely the fix router-issues.md §137 asks for
(clearance / shorting / tracks_crossing / solder_mask_bridge = 0; unroutable nets reported open).
fab_router's design also removes R3 (copper-to-edge: DR-11 + `copperToEdgeClearanceUm`), R4
(hole clearance same-net exemption: DR-06a/DR-02/DR-12), and R8 (bounded, `AbortSignal`-cancellable,
never a minutes-long non-yielding solve) by construction.

## The one fab_router gap this exposes

fab_router **under-completes fine-pitch fanout by leaving trapped inner pads open (0 vias added)**
instead of dropping a fanout via to escape them to the back layer. On the QFN this costs 2/14; on the
USB-C two-row 0.5 mm connector it costs 4/6 (the inner row cannot escape on the surface at all). This
is a real, bounded, fixable capability — SMD fine-pitch via-escape in `src/route/fanout.ts` — and it
is distinct from the dense-board completion plateau (evidence/reports/M10-report.md): here the
router simply is not attempting the via drop that fine-pitch escape requires.

Next step (not yet done, awaiting go-ahead): harden `src/route/fanout.ts` so a fine-pitch SMD pad
that cannot escape on its own layer drops a via to an adjacent layer and completes there, then
re-measure these two cases (target: inner pads complete, still 0 added violations).
