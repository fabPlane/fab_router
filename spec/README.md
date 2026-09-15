# The specification

This directory is the behavioural specification and acceptance corpus for the router: the formats
it reads and writes, the design rules it enforces, and the numbers a run must reach. With
`docs/DESIGN.md` and the published literature cited in `glossary.md`, it is the complete
description of what the router must do.

## The one rule for writing here

**Describe behaviour and acceptance, never procedure.** Every sentence must describe something an
external observer could check — an input and the required output, a format and its meaning, a rule
and its observable consequence, a number a run must reach.

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

## How the baseline data was produced

Every file under `acceptance/parse`, `acceptance/reference`, `acceptance/ses`, and `behaviour/`
records numbers observed by running an established baseline router on a board or on generated
inputs — a black-box measurement, noted in each file's `_generated` header.

