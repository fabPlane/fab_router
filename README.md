# fab_router

[![milestones](https://img.shields.io/badge/milestones-M0%E2%80%93M10-2ea44f)]()
[![DRC-clean](https://img.shields.io/badge/R--1-DRC--clean%20by%20construction-2ea44f)]()
[![tests](https://img.shields.io/badge/tests-857%20passing-2ea44f)]()
[![runtime](https://img.shields.io/badge/runtime-Bun%20%E2%89%A51.4-black)](https://bun.sh)
[![licence](https://img.shields.io/badge/licence-GPL--3.0%20OR%20FabPlane%20Commercial-blue)](LICENSE)

A PCB autorouter for the FabPlane toolchain, in TypeScript for Bun. SPECCTRA DSN in, SES out;
tscircuit SimpleRouteJson as a second adapter.

- [`docs/DESIGN.md`](docs/DESIGN.md) — the architecture brief and vocabulary.
- [`spec/`](spec/README.md) — the behavioural specification and acceptance corpus.

```bash
bun install
bun run typecheck && bun run check:layers && bun run test
bun run acceptance -- --tier slow
```

## Status

Milestones M0–M10 complete (tags `M0`…`M10`). The router reads SPECCTRA DSN, checks DRC and
connectivity, routes multilayer boards with vias, rip-up, fanout, push-and-shove, a gridless
detailed router (line-search + corner-stitch tiles) and a monotone optimiser, writes and applies
SES, drives the tscircuit SimpleRouteJson adapter, and carries an off-by-default two-phase
global-planning subsystem. **It never adds a DRC violation (invariant R-1) on any board at any
setting.**

Acceptance: 401 non-routing cases pass; all feature routing cases (4-/6-layer, plane layers,
strict-DRC, item caps, DAC bm08) pass to their bounds; the tscircuit SRJ boards pass their hard
metrics.

**Completion frontier.** On the ~12 densest routing cases the router completes fewer nets than the
best-known baseline (with zero added violations throughout). This was established as a fundamental
limit of the detailed router's local search from four independent directions — every detailed
mechanism (M9), every negotiated-congestion knob (I12), a complete global router (M10), and a
full-detailed-PathFinder loop (I17). Closing it would need a deep reworking of the core routing
algorithm or a topological/rubber-band router; both are large and uncertain.

## Licence

**Dual — GPL-3.0 OR a FabPlane Inc commercial licence** (see [`LICENSE`](LICENSE); the full GPL
text is in [`COPYING`](COPYING)). Use is governed by the GPL unless you hold a commercial licence
from FabPlane Inc. Contributions are accepted under both licences. Copyright © FabPlane Inc.
