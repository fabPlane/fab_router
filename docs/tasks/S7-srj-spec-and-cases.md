# Task S7 — SRJ format spec, connectivity model, and srj-* acceptance cases

Role: spec-curator. Write set: `spec/formats/srj.md`, `spec/rules/connectivity.md` (an SRJ section
only), `spec/acceptance/cases/srj-*.json`, `spec/acceptance/reference/*.srj.*.json`,
`spec/behaviour/scenarios/` (an SRJ scenario if useful), `spec/types/` is NOT in your set —
propose type changes in `spec/formats/srj.md` for the orchestrator to apply.

Read `spec/types/srj.ts`, `spec/api/contract.md` (SimpleRouteJson, Q-I0-8), `docs/DESIGN.md` §7,
the SRJ questions in `src/QUESTIONS.md` (66, 67, 68), and the four `boards/b223-j802*.srj.json`.

Tainted specifics (reference locations, harness placement) are in the private runbook named in
your spawn prompt; run reference B as a black box, keep generators out of the repo.

## Deliverables

1. **`spec/formats/srj.md`** — the SimpleRouteJson ↔ Layout mapping as behaviour: units, `bounds`
   → Rim, `layerCount` → Stack, `obstacles` (rect/oval/polygon, `connectedTo`) → Pours/Fences,
   `connections[].pointsToConnect` → the required links, via sizing, and the `pcb_trace` output
   shape. Resolve **Q-67**: state the actual `differentialPairs` field names as the corpus writes
   them (`connectionNames`, `lengthTolerance`, `traceGap`, `maxUncoupledLength`), and which the
   adapter must accept; propose the `spec/types/srj.ts` change.
2. **Connectivity model (Q-68)** — decide, by observing reference B's required-connection count and
   routed result on the J802 boards, whether net-owned pre-existing copper is (a) an independent
   connectivity terminal (each fragment must be re-stitched) or (b) same-net copper the router may
   attach to but need not stitch, with the required links coming only from `pointsToConnect`.
   Record the ruling and the observed numbers in `spec/formats/srj.md` and a short SRJ subsection of
   `spec/rules/connectivity.md`.
3. **`srj-*` cases** — from reference B on the four J802 boards (and any SRJ behaviour in its test
   suite worth pinning): `kind: srj`, `expect` on `incomplete`, `violations` (`maxAdded: 0`), and
   per-pair `skewMm` where diff pairs exist. Record reference numbers in
   `spec/acceptance/reference/<board>.srj.<profile>.json`. Mark via-dependent completion bounds so
   they become reachable once the barrel-aware router (I5) lands; keep `violations.maxAdded: 0`
   hard.

Run `bun run spec:lint`; commit with spec-curator trailers; report the ruling on Q-68 and the
cases written.
