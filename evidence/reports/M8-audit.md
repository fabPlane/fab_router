# M8 audit — clean-room evidence (orchestrator, 2026-09-14)

## 1. Independent-creation process

fab_router was built by isolated `implementer`/`verifier` agents that never had filesystem access
to either reference implementation (the GPL Java router "reference A" or the private TS port
"reference B"). Access was enforced by the PreToolUse wall hook (`tools/wall/pretooluse.ts`); every
attempt to cross it is logged in `evidence/wall-denials.jsonl`, and the wall self-test
(`bun run wall:selftest`, 47 cases) plus two live implementer probes recorded at M0 demonstrate the
rules fire. The behavioural specification in `spec/` — the implementers' entire input — was written
by tainted `spec-curator` agents and the orchestrator; `bun run spec:lint` gate-kept every drop
against a private list of reference identifiers, and passes clean on the whole tree.

Evidence retained:
- `evidence/agent-sessions.jsonl` — every spawned agent (role, id, session, HEAD, spec-tree hash).
- `evidence/wall-denials.jsonl` — every wall denial by rule id (matched text in the private log).
- `evidence/transcripts.manifest.json` + `evidence/manifests/M*.json` — SHA-256 of every agent
  transcript, snapshotted per milestone into the private workspace.
- Commit trailers on all commits (`Wall-Role`/`Agent-Id`/`Spec-Tree`); every `src/`/`test/` commit
  carries `Wall-Role: implementer` (audited by `tools/wall/check-trailers.sh`).

## 2. Similarity gate — final full-tree run

`bun run similarity -- --milestone M8-audit`: 76 candidate files (`src/` + `test/`) vs 842
reference files, winnowed k-gram fingerprints (Schleimer, Wilkerson & Aiken 2003) over
identifier-normalised tokens.

- **IDENT (banned reference identifiers in src/test): 0.** (The one collision found during
  development, a fanout result type, was renamed to `FanoutOutcome`.)
- **PAIR (file-level fingerprint overlap ≥ 0.15): 0.**
- **RUN (shared token runs ≥ 40): 12**, every one a low-entropy generic construct verified by
  reading the candidate text — all reviewed across `evidence/similarity/M*-review.md`:
  object-literal initialisers (`src/drc/*`, `src/layout/summary.ts`), a textbook ray-crossing
  point-in-polygon test (`src/geom/predicates.ts`), lexer/reader prologues and re-export lists
  (`src/dsn/*`), accumulator prologues (`src/route/legalise.ts`, `src/layout/*`), and
  `expect(...).toBe(...)` bounds-loops in tests. Cross-language (TS-vs-Java) matches on plain
  loops are expected from identifier normalisation. None reproduce reference expression.
- CONST: 87 shared numeric literals — iteration counts, bit widths, geometry bounds; informational.

**Verdict: no copying indicated.** The router's algorithms (A*, Theta* shortcutting, PathFinder
negotiated-congestion rip-up, uniform-grid spatial index, k-DOP expansion, monotone-chain hull)
are built from the literature cited in `spec/glossary.md`; the vocabulary (Layout/Sheet/Track/
Barrel/Pad/Pour/Fence/Quilt/Lattice/Prior copper) is the project's own.

## 3. Acceptance status (commit at tag M7)

- typecheck, check:layers, full `bun run test` (794) — green.
- Non-routing acceptance — parse 182/182, ses-roundtrip 148/148, ses-apply 38/38, rules 10/10,
  settings 14/14, drc 9/9.
- **R-1 (`violations.maxAdded == 0`) holds on all 59 routing + 4 srj cases, every setting.**
  R-2, R-3, R-5, R-6 hold. srj `preExisting == 0` hard on all four J802 boards.
- Feature routing cases pass to hard bounds: DAC bm08 exact-0, Issue066 (4-layer), Issue289
  (6-layer), all Issue269 plane boards, strict-DRC CNH, all 22 item-cap cases.

## 4. Known limitation (follow-up, not a correctness gap)

Completion on the densest boards falls short of the reference: DAC bm07 reaches 6 (target 0),
and `cm5-carrier`, `green14seg`, `bm01-p2`, the fanout-route exact-0 cases, `bm11-fanout-only`
(145/154), and J802 (1–9 of 15) similarly. **Every one adds zero DRC violations** — the shortfall
is how many nets complete, a limit of the coarse-grid A*/negotiated-congestion search confirmed
empirically in I7 (5× search budget, forced fine grid, 90 s budgets, 10× stagnation all plateau).
Closing it requires a gridless/fine detailed router with push-and-shove — a separate milestone.

## 5. Licence

The independent-creation evidence above (isolated implementers, retained transcripts, clean
similarity gate, human-implementable behavioural spec) is the basis on which this router — unlike
the derivative reference B — can carry a permissive licence. Per `docs/WALL.md`, the one open
question is the AI-training-data point, which is for counsel; the actual licence file and text are
left to the user + counsel rather than asserted here.
