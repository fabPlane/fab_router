# fab_router — plan

## Context

fab_router is a clean-room reimplementation of a PCB autorouter in TypeScript for Bun. Two
reference implementations exist in a private workspace outside this repository: **reference A**,
a GPL-licensed Java router, and **reference B**, a private TypeScript port of A. Because B is a
transcription of A it is a derivative work and cannot be relicensed; renaming its classes would
not change that. The only path to a freely licensable router is an implementation built from a
behavioural specification by people (here: agents) who never read either reference. That is what
this repository does, with the process in [`WALL.md`](WALL.md) and the architecture in
[`DESIGN.md`](DESIGN.md).

Decisions taken up front:

- **Real wall.** Spec curators (tainted) write `spec/`; implementers (isolated) build `src/` from
  `spec/` only; a hook enforces it and transcripts are retained.
- **Behavioural parity, not bit parity.** The acceptance bar is: zero router-added DRC violations,
  completion within tolerance of the references on the whole board corpus, runtime within budget.
  The implementation is free to use its own algorithms and data structures — and should, since a
  fresh design also escapes the references' known weaknesses.
- **Both reference test suites are adapted**, as declarative acceptance cases, minus peripheral
  tooling (telemetry, hosted APIs, editor plugins, performance harnesses, native bindings).
- **Concurrency.** Spec curation, implementation, and verification run as groups of agents in
  parallel wherever the milestone dependencies allow.

## Repository layout

```
.claude/settings.json, .claude/agents/          hooks and the three agent roles (see WALL.md)
docs/PLAN.md  WALL.md  DESIGN.md                this plan, the process, the architecture brief
docs/tasks/<role>-<n>-<slug>.md                 task files: the only channel to implementers
spec/README.md  glossary.md                     how to read the spec; neutral vocabulary + literature
spec/api/contract.md  settings.md  types/*.ts   the public API, frozen before implementers start
spec/formats/{dsn,dsn-dialects,ses,rules,padstack-names}.md
spec/rules/{clearance,nets,vias,keepouts,layers,connectivity,drc}.md
spec/behaviour/geometry/*.jsonl  dsn-tokens/*.jsonl  scenarios/*.md
spec/acceptance/boards/  parse/  reference/  ses/  cases/  schema/   (see "What crosses the wall")
src/  test/  tools/acceptance/                  implementer-owned
tools/wall/  tools/similarity/  tools/check-layers.ts
evidence/                                       agent ledger, denials, transcript manifests, reports
```

## What crosses the wall

Produced spec-side by running the references as sealed programs; every drop is checked by
`bun run spec:lint` before it is committed. The rule for each artifact: it states what a correct
router observes or produces, never how a reference computes it.

1. **Boards** — the corpus of ~150 DSN boards (issue-tracker test cases from many CAD exporters,
   a set of published benchmark boards, several multilayer boards), their reference session and
   rules files where they exist, plus five user boards (a 6-layer CM5 carrier and a 6-layer J802
   board in SimpleRouteJson form). Data, not code. `boards/MANIFEST.json` carries SHA-256,
   provenance, and a fast/slow tier.
2. **Reference numbers** per board and settings profile (`default`, `p1` single pass, `fanout`,
   `strict`, `novia`): connections, incomplete before/after, vias, trace length, violations
   before/after, passes, wall clock (advisory). Median of three runs, from both references. Where
   the references disagree, the spec records both and rules (for example: a copper pour connects
   its net, matching the CAD tool's own DRC).
3. **Parse summaries** per board in neutral vocabulary (layers, nets, parts, padstacks, item
   counts, pre-existing wiring, rule matrix, keepouts, outline bbox).
4. **Session-file expectations** — the normalised s-expression tree of the unrouted session per
   board (byte identity is *not* required) and, for boards with a reference session, the
   statistics after applying it.
5. **Geometry predicate vectors** for universally-defined operations only (orientation, segment
   intersection, rational line intersection, point-in-polygon, point–segment distance,
   perpendicular foot, polygon area, convex hull).
6. **Lexeme vectors** for the DSN tokenizer (quote variants, number forms, punctuation in
   identifiers).
7. **Format specs** written from the published SPECCTRA Design Language Reference plus observed
   exporter dialects, each quirk as: observed input → required interpretation → boards where it
   occurs.
8. **Rule semantics** as observable behaviour: clearance classes and the class × class × layer
   matrix with pair types; nets, subnets, net groups; via rules and layer ranges; keepout kinds
   and scoping; signal vs plane layers and inactive layers; what counts as connected; what a
   violation is and the invariant that routing never adds one.
9. **Scenarios** for search and optimisation, outcome-only ("this net on this board is routable
   without vias"; "the optimiser never increases via count or length").
10. **API contract and glossary**, designed fresh, with literature citations.

## Acceptance cases

Both reference suites are translated into one declarative case format consumed by a single generic
runner (`test/acceptance.test.ts`, `tools/acceptance/run.ts`):

```json
{ "id": "routing-slow-bench07-complete", "kind": "routing", "origin": "refA-suite", "tier": "slow",
  "board": "<board>.dsn", "settings": { "maxPasses": 100, "timeoutSeconds": 30 },
  "expect": { "incomplete": { "exact": 0 }, "violations": { "maxAdded": 0 }, "passes": { "max": 9 },
              "wallClockMs": { "max": 30000, "advisory": true },
              "vias": { "maxRatioToReference": 1.5 }, "traceLengthMm": { "maxRatioToReference": 1.3 } } }
```

Kinds: `routing | parse | ses-roundtrip | ses-apply | rules | drc-load | settings | srj`.
Expectation operators: `exact | max | min | maxAdded | maxRatioToReference | preExisting`.
`origin` marks cases that exist in both suites so nothing is double-counted. Settings vocabulary
is exactly the one the reference suites use (`spec/api/settings.md`). Expected yield: roughly
90–110 routing cases, ~40 parse/session/rules cases, ~15 DRC/settings cases, plus SRJ cases.

Dropped from both suites: GUI, hosted API, analytics, i18n, logging, management, editor plugins,
telemetry, performance harnesses, native-binding parity, and every test of a reference's internal
structure. Implementers write their own unit tests for their internals.

## Agent groups

- **Orchestrator** (main session, tainted): owns the API contract, task files, case curation,
  merges, and milestone gates. Never writes `src/`.
- **Group S — spec curators** (tainted, up to 4 concurrent, disjoint write sets): S1 formats +
  lexeme vectors + session expectations; S2 rules + parse summaries + glossary; S3 corpus +
  manifest + reference numbers + routing/DRC cases; S4 geometry vectors + scenarios + settings
  cases + API review.
- **Group I — implementers** (isolated worktrees, branch `impl/<id>`): I0 foundation (module
  skeleton, geometry kernel, vector test, acceptance runner, compiling API stubs); I1 DSN reader +
  Layout + rule resolution; I2 session writer/reader, rules files, DRC, connectivity, stats; I3
  Lattice + clearance queries; I4 router core (Quilt, search, pull, legalise, Journal, passes,
  cancellation); I5 fanout, rip-up, Barrels/multilayer, nudge, optimiser, strict DRC; I6 SRJ
  adapter + differential-pair measurement.
- **Group V — verifier**: one per gate; runs the verification commands and writes
  `evidence/reports/M<n>.md`.

Hand-off: a curator commits → orchestrator runs `spec:lint` → writes `docs/tasks/I<n>-<slug>.md`
→ spawns an implementer with the prompt `Task: docs/tasks/I<n>-<slug>.md` in its own worktree →
the implementer commits with trailers and leaves open questions in `src/QUESTIONS.md` → a
verifier reports on the branch → the orchestrator merges `--no-ff` or re-spawns the implementer
with the report path added to its task file. Questions are answered by editing `spec/`, never by
pasting into a prompt. Concurrency cap: 4 agents (acceptance runs are CPU-bound).

## Milestones

| M | Who | Definition of done |
|---|---|---|
| **M0 wall + scaffold** | orchestrator | repo, hooks, agent roles, package config, this plan, `WALL.md`, `DESIGN.md`, `spec/` skeleton + schemas + API contract + shared types; `spec:lint` and `wall:selftest` green; git hooks installed; first evidence snapshot; first commit |
| **M1 spec drop 1** | S1 S2 S4 | formats, dialects, layers, glossary, settings, all parse summaries, geometry + lexeme vectors, parse cases; orchestrator review: "does every sentence describe an observable outcome?" |
| **M2 read + foundation** | I0 ∥ I1 | typecheck green; every vector passes; parse cases pass for every board (advisory where the references disagreed); DSN read → write → read deep-equal; similarity gate clean |
| **M3 spec drop 2 → I/O + DRC + index** | S1 S2 S3, then I2 ∥ I3 | session/rules/DRC-load/settings cases pass; DRC-at-load counts equal the reference; Lattice property tests vs brute force |
| **M4 spec drop 3 → routing v1** | S3 S4, then I4 | fast-tier routing cases with vias disabled: router-added violations = 0 on every board (a hard gate from here on); completion at or above the per-board floors; cancellation, `maxItems`, `maxPasses` semantics hold |
| **M5 routing v2** | I4 ∥ I5 | full corpus: added violations 0; completion ≥ reference − 3 percentage points per board; the two benchmark boards that the references complete are completed; pass-limited cases within bounds; strict-DRC case adds nothing to pre-existing violations; 4- and 6-layer boards route; plane-layer boards respected |
| **M6 optimiser + adapters** | I5 ∥ I6 | completion ≥ reference; median track length ≤ 1.15× and vias ≤ 1.2× reference; SRJ round-trip; J802 boards fully routed; differential-pair gap/skew cases |
| **M7 quality + performance** | I4/I5 | CM5 carrier: all 74 connections in ≤ 120 s (600 s full pipeline), zero added violations; whole-corpus wall time ≤ 1.5× reference, any single board ≤ 2×, RSS ≤ 1 GB |
| **M8 audit** | orchestrator + V | similarity gate over all of `src/` and `test/`; evidence bundle and transcript manifest; this plan and the README re-linted; licence file added |

## Verification

| Command | What |
|---|---|
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | unit tests + behaviour vectors + fast-tier acceptance (`--timeout 120000`) |
| `bun run acceptance -- --tier slow [--case <glob>] [--report <file>]` | full acceptance with per-case JSON |
| `bun run check:layers` | import-order check |
| `bun run wall:selftest [-- --probe-check <since>]` | hook rules (offline) / live probe denials |
| `bun run similarity -- --milestone M<n>` | similarity gate report to `evidence/similarity/` |
| `bun run spec:lint` | banned-term scan over everything that crosses the wall |
| `bun run evidence:snapshot -- M<n>` | transcript snapshot + manifest |
| `tools/wall/check-trailers.sh <from>..<to>` | commit-trailer audit |

A milestone gate is all of the above green, an evidence snapshot, a verifier report, and valid
trailers on every commit since the previous gate. The project is done when every fast and slow
case passes or is explicitly `advisory` with a reason, zero router-added violations hold on the
whole corpus, the similarity report is clean, and the evidence bundle is complete.
