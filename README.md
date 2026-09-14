# fab_router

A clean-room PCB autorouter for the FabPlane toolchain, in TypeScript for Bun. SPECCTRA DSN in,
SES out; tscircuit SimpleRouteJson as a second adapter.

- [`docs/PLAN.md`](docs/PLAN.md) — what is being built, by whom, in what order.
- [`docs/WALL.md`](docs/WALL.md) — the clean-room process and its evidence.
- [`docs/DESIGN.md`](docs/DESIGN.md) — the architecture brief and vocabulary.
- [`spec/`](spec/README.md) — the behavioural specification and acceptance corpus.

```bash
bun install
bun run typecheck && bun run check:layers && bun run test
bun run acceptance -- --tier slow
```

## Status — delivered (M0–M10)

Milestones M0–M10 complete (tags `M0`…`M10`). The router reads SPECCTRA DSN, checks DRC and
connectivity, routes multilayer boards with vias, rip-up, fanout, push-and-shove, a gridless
detailed router (line-search + corner-stitch tiles) and a monotone optimiser, writes and applies
SES, drives the tscircuit SimpleRouteJson adapter, and carries an off-by-default two-phase
global-planning subsystem. **It never adds a DRC violation (invariant R-1) on any board at any
setting** — held through every merge, each similarity-reviewed (no copying indicated).

Acceptance: 401 non-routing cases pass; all feature routing cases (4-/6-layer, plane layers,
strict-DRC, item caps, DAC bm08) pass to their bounds; the tscircuit SRJ boards pass their hard
metrics.

**Completion frontier (accepted).** On the ~12 densest routing cases the router completes fewer
nets than the reference (with zero added violations throughout). This was established as a
fundamental limit of the detailed router's local search from four independent directions — every
detailed mechanism (M9), every negotiated-congestion knob (I12), a complete global router (M10),
and the reference's own full-detailed-PathFinder approach (I17 spike). Closing it would require a
deep reimplementation of the core routing algorithm or a topological/rubber-band rewrite that
reopens R-1; both are large and uncertain. See `evidence/reports/M10-report.md` for the full
analysis and per-board numbers.

## Provenance and licence

`src/` and `test/` were written entirely by isolated agents that never accessed any existing
autorouter's source, working only from the behavioural specification in `spec/`. The clean-room
process, its enforcement, and the retained evidence are documented in `docs/WALL.md`; the M8 audit
(`evidence/reports/M8-audit.md`) records a clean similarity gate over the whole tree (no copying
indicated). Because the work is independently created, FabPlane Inc holds its copyright and can
license it on its own terms.

**Licence: dual — GPL-3.0 OR a FabPlane Inc commercial licence** (see [`LICENSE`](LICENSE); the
full GPL text is in [`COPYING`](COPYING)). Use is governed by the GPL unless you hold a commercial
licence from FabPlane Inc. Contributions are accepted under both licences. The AI-training-data
consideration noted in `docs/WALL.md` is a matter for FabPlane and its counsel.
