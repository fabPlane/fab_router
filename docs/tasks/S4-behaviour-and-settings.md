# Task S4 — geometry vectors, routing scenarios, settings cases, API review

Role: spec-curator. Write set: `spec/behaviour/geometry/`, `spec/behaviour/scenarios/`,
`spec/acceptance/cases/settings-*.json`, `spec/acceptance/cases/rules-*.json`,
`spec/acceptance/cases/ses-roundtrip-*.json`, `spec/api/REVIEW.md`.

## Deliverables

1. `spec/behaviour/geometry/*.jsonl` — predicate vectors for **universally defined** operations
   only, one file per op: `orientation` (sign of the cross product for three integer points,
   including collinear and near-collinear cases up to |coord| = 2^25), `segment-intersection`
   (boolean, with touching/collinear-overlap cases), `line-intersection-point` (exact rational
   result as reduced integer numerator/denominator pairs, plus parallel/coincident outcomes),
   `point-in-polygon` (integer polygon, boundary cases), `point-segment-distance` (exact squared
   distance as a rational), `perpendicular-foot`, `polygon-area` (signed, integer ×2),
   `convex-hull` (small point sets, canonical CCW order starting from the lowest-then-leftmost
   point). Produce expected values by running a reference where it exposes the operation and
   cross-check every record with an independent exact (bigint) computation you write in the
   private workspace; keep only records both agree on. Each line: `{ "op", "input", "expected",
   "note"? }`; a header line `{ "_generated": "..." }` first. Aim for ≥ 2 000 records per op with
   the large-coordinate regime well covered.
2. `spec/behaviour/scenarios/*.md` — outcome-only scenarios: for the boards in the corpus, which
   connections are routable with vias disabled (from the `novia` reference profile: list net
   names per board whose connections both references complete on one Sheet); fixed-item
   invariance ("routing this board must not move or remove any held item; here are their counts");
   optimiser monotonicity ("after the optimiser, via count and total length must not exceed the
   pre-optimiser values"); fanout observable ("with fanout enabled on these boards, at least N SMD
   pads gain a via escape"). No description of search procedure, ordering, or internal state.
3. `spec/acceptance/cases/settings-*.json` — cases of kind `settings`: DSN autoroute settings and
   rules-file settings → `report.effectiveSettings` fields (bend cost, neck width, trace costs,
   layer activity, via costs), with and without `useFileSettings`.
4. `spec/acceptance/cases/rules-*.json` — every `.rules` file in the corpus: accepted or rejected,
   and the effective clearance/width values after applying it.
5. `spec/acceptance/cases/ses-roundtrip-*.json` — one per board (fast unless the board is slow).
6. `spec/api/REVIEW.md` — a review of `spec/api/contract.md`, `spec/api/settings.md`, and
   `spec/types/*.ts` against everything the cases in `spec/acceptance/cases/` need: list every
   field a case references that the contract lacks, every ambiguity, and proposed clause text.
   Do not edit the contract yourself; the orchestrator applies the review.

## Rules of writing
Behaviour only; nothing about how any reference computes anything. `bun run spec:lint` must be
clean before you commit (spec-curator trailers).
