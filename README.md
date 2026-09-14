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

## Status

Milestones M0–M7 complete (tags `M0`…`M7`). The router reads SPECCTRA DSN, checks DRC and
connectivity, routes multilayer boards with vias, rip-up, fanout and a monotone optimiser, writes
and applies SES, and drives the tscircuit SimpleRouteJson adapter. **It never adds a DRC violation
(invariant R-1) on any board at any setting.** Acceptance: 401 non-routing cases pass; all feature
routing cases (4-/6-layer, plane layers, strict-DRC, item caps, DAC bm08) pass to their bounds.

Known follow-up: completion on the densest boards and J802 falls short of the reference (zero added
violations throughout) — a coarse-grid search limit that needs a gridless detailed router with
push-and-shove. See `evidence/reports/M8-audit.md` §4.

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
