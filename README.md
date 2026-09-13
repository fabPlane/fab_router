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

Status: M0 (wall + scaffold). No router code exists yet; `src/` is written only by isolated
implementer agents from `spec/`.

Licence: to be decided at the audit milestone; the process in `docs/WALL.md` exists so that a
permissive licence is possible.
