# The specification

This directory is the complete input of the implementers. If it is not in here (or in
`docs/DESIGN.md`, `docs/tasks/`, and the published literature cited in `glossary.md`), an
implementer does not know it.

## The one rule for writing here

**Describe behaviour and acceptance, never procedure or structure.** Every sentence must describe
something an external observer could check — an input and the required output, a format and its
meaning, a rule and its observable consequence, a number a run must reach. Nothing here describes
how any existing router is organised or how it computes anything.

## Precedence

When two statements conflict, the more specific and the more recent wins, in this order:

1. `acceptance/cases/*.json` — a case is the final word on what must pass.
2. `acceptance/reference/*.json`, `acceptance/parse/*.json`, `behaviour/**` — recorded observations.
3. `rules/*.md`, `formats/*.md` — the written semantics; numbered clauses (`C-xx`, `F-xx`, `D-xx`).
4. `api/contract.md`, `api/settings.md`, `types/*.ts` — the surface the runner compiles against.
5. `glossary.md`, `docs/DESIGN.md` — vocabulary and recommended design.

Clauses are numbered so that questions and rulings can cite them. A ruling added in answer to an
implementer question is a new clause, never an edit of prose in a prompt.

## Layout

```
glossary.md                  vocabulary, literature
api/contract.md              public functions, result shapes, errors, determinism, cancellation
api/settings.md              settings vocabulary, defaults, meaning of each setting
types/*.ts                   the shared TypeScript contracts (importable from src/ and test/)
formats/                     DSN, SES, rules files; observed dialects
rules/                       clearance, nets, vias, keepouts, layers, connectivity, DRC
behaviour/geometry/          predicate vectors (JSONL)
behaviour/dsn-tokens/        lexeme vectors (JSONL)
behaviour/scenarios/         outcome-only routing scenarios
acceptance/README.md         runner contract and tiers
acceptance/schema/           JSON schemas for cases, references, parse summaries
acceptance/boards/           the board corpus (data) + MANIFEST.json
acceptance/parse/            normalised parse summary per board
acceptance/reference/        reference statistics per board and settings profile
acceptance/ses/              normalised unrouted session tree per board
acceptance/cases/            the declarative acceptance cases
```

## How reference data was produced

Every file under `acceptance/parse`, `acceptance/reference`, `acceptance/ses`, and `behaviour/`
was produced by *running* a reference implementation on a board or on generated inputs and
recording what it observed or emitted — a black-box measurement. Each such file states this in a
`_generated` header field. No reference source text was consulted to write the prose in this
directory beyond determining which observable behaviours to test.
