# The wall

fab_router is a clean-room implementation. Its purpose is to produce a PCB autorouter whose code
is independently created, so that it can be licensed freely. That claim rests on a process, and
this document is the process.

## Roles

| Role | Sees the reference implementations? | May write | Enforced by |
|---|---|---|---|
| **orchestrator** (the main session) | yes | `.claude/`, `docs/`, `spec/`, `tools/wall`, `tools/similarity`, `evidence/`, package config — never `src/`, `test/`, `tools/acceptance/` | hook rule `W-SCOPE` |
| **spec-curator** (`.claude/agents/spec-curator.md`) | yes | `spec/**`, `docs/tasks/S-*` | `W-SCOPE` |
| **implementer** (`.claude/agents/implementer.md`) | **no** | `src/**`, `test/**`, `tools/acceptance/**` | all isolated rules |
| **verifier** (`.claude/agents/verifier.md`) | **no** | `evidence/reports/**`, `evidence/similarity/**` | all isolated rules + `V-RO` |

The two reference implementations are referred to in this repository only as **reference A** (a
GPL-licensed Java router) and **reference B** (a private TypeScript port of A). Both live in a
private workspace outside this repository. They are run as sealed programs to produce the numbers
under `spec/acceptance/reference/`; nothing else from them crosses into this tree.

## What crosses the wall

Everything an implementer sees is under `spec/` and `docs/`. The rule for every file there:

> It describes what a correct router **observes or produces** — formats, rules, inputs and
> required outputs, acceptance numbers — never **how** either reference computes it.

Concretely, allowed across the wall: board files (data, not code); per-board reference statistics
produced by running the references; normalised parse summaries; universally-defined geometry
predicate vectors; format specifications written from the published SPECCTRA reference; rule
semantics restated as observable behaviour; outcome-only routing scenarios; the public API
contract; a glossary with literature citations.

Not allowed: class, file, or identifier names from either reference; descriptions of their
internal structure, ordering, data structures, or tie-breaking; any oracle data that encodes
their internals (tree shapes, undo sequences, search-space objects).

A lint (`bun run spec:lint`) rejects any file under `spec/`, `docs/`, `tools/`, `.claude/`, or
`evidence/` that contains a term from a private banned-identifier list harvested from both
references.

## The hook

`.claude/settings.json` registers `tools/wall/pretooluse.ts` as a `PreToolUse` hook for every
file, shell, web and agent tool. It reads the calling agent's role from the hook input and applies:

| Rule | Roles | Effect |
|---|---|---|
| `T-PATH` | implementer, verifier | deny any tool input mentioning a path on the private denylist |
| `T-WORD` | implementer, verifier | deny any tool input containing a denylisted word |
| `P-OUT` | implementer, verifier | deny any resolved path under the user's home that is outside this checkout, the Bun toolchain, or the session scratchpad |
| `P-SYMLINK` | implementer, verifier | deny paths that resolve through a symlink to outside the allowed roots |
| `B-ESCAPE` | implementer, verifier | deny shell commands that create symlinks, use the network, add packages, or touch git remotes; deny web tools |
| `B-TRAVERSE` | implementer, verifier | deny `..` segments that resolve above the checkout |
| `W-SCOPE` | all | deny edits outside the role's write set (including shell redirections and copies) |
| `A-PROMPT` | orchestrator, spec-curator | an implementer or verifier may only be spawned with the prompt `Task: docs/tasks/<name>.md`, and that file must pass `spec:lint` |
| `A-SPAWN` | implementer, verifier | deny spawning agents |
| `V-RO` | verifier | deny writes outside `evidence/reports/` and `evidence/similarity/` |
| `CONFIG-MISSING` | implementer, verifier | if the private denylist is unreachable, deny everything |

The denylist itself is private (`FAB_ROUTER_WALL_CONFIG`, set in the uncommitted
`.claude/settings.local.json`), so this repository never names what it is walling off.

`bun run wall:selftest` feeds synthetic tool calls through the hook and asserts every rule fires;
`docs/tasks/wall-probe.md` is a live probe an implementer agent is run against at each milestone
gate, and `bun run wall:selftest -- --probe-check <since>` asserts its attempts were denied.

**Honest limit.** A hook is a fence, not a vault: it makes accidental leakage impossible and
deliberate leakage loud, but the primary evidence of independent creation is the retained
transcripts showing what each implementer actually read.

## Evidence

- `evidence/agent-sessions.jsonl` — one line per spawned agent (role, id, session, checkout,
  commit, spec-tree hash), written by the `SubagentStart` hook.
- `evidence/wall-denials.jsonl` — one line per denial (timestamp, role, id, tool, rule). The
  matched text is kept only in a private log.
- `evidence/transcripts.manifest.json` and `evidence/manifests/<milestone>.json` — SHA-256 of
  every agent transcript retained privately at each milestone (`bun run evidence:snapshot -- M<n>`).
- `evidence/reports/<milestone>.md` — the verifier's report per gate.
- `evidence/similarity/<milestone>.json` — the similarity gate's report (`bun run similarity`):
  winnowed k-gram fingerprints (Schleimer, Wilkerson & Aiken 2003) over identifier-normalised
  tokens of every file in `src/` and `test/` against every file of both references, flagging
  shared runs ≥ 40 tokens, file-pair overlap ≥ 15 %, banned identifiers, and shared non-trivial
  constants. Reference files are named by opaque ids; the id → path map stays private.
- Commit trailers, enforced by a `commit-msg` hook (`bun run hooks:install`): `Wall-Role:`,
  `Agent-Id:`, `Spec-Tree:`. Commits touching `src/`, `test/`, `tools/acceptance/` must carry
  `Wall-Role: implementer`; commits touching `spec/` must be `orchestrator` or `spec-curator`.
  `tools/wall/check-trailers.sh <from>..<to>` audits a range.

## Milestone gate

A milestone is closed only when all of the following are green and recorded:
`bun run typecheck`, `bun run check:layers`, `bun run test`, the milestone's acceptance tier,
`bun run wall:selftest` (offline and probe), `bun run similarity` (zero unreviewed findings;
reviewed ones documented in `evidence/similarity/<milestone>-review.md`), `bun run spec:lint`,
an evidence snapshot, a verifier report, and valid trailers on every commit since the last gate.

## Known risks

- **Training data.** The implementing model may have been trained on public router source. The
  mitigations are the explicit instruction not to recall or reproduce any router's source, a spec
  detailed enough for a human to implement from, and the similarity gate as release evidence. This
  is a question for counsel, not an engineering one; nothing here is legal advice.
- **The two references disagree** in places (for example whether a copper pour counts as
  connecting its net). The spec records both observations and its ruling with a reason;
  implementers see only the ruling.
- **Wall-clock numbers** depend on hardware and are advisory everywhere; pass counts, completion,
  and added-violation counts are the real bars.
