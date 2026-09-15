# Geometry predicate vectors

One JSONL file per operation. The first line of each file is a header object with a single
`_generated` field describing how the file was produced; every other line is one record:

```json
{ "op": "<file name without extension>", "input": { ... }, "expected": ..., "note": "optional free text" }
```

Every record was evaluated twice — by a baseline router run as a black box and by an
independent exact big-integer computation — and kept only when both agreed. An implementation must
reproduce `expected` for every record, exactly. Each file has at least 2 000 records; roughly half
of them use coordinates in the large regime (|coord| up to 2^25 = 33 554 432, including values that
hug that bound), the rest are small (|coord| ≤ 100) or medium (|coord| ≤ 100 000).

All coordinates are integers in layout units (LU). Points are `[x, y]`. The coordinate system is
the usual mathematical one (x to the right, y up): "left of the directed line a→b" means the
counter-clockwise side. Exact rational results are encoded as `[numerator, denominator]` pairs
of decimal integer strings, reduced to lowest terms with a positive denominator (an integer result
has denominator `"1"`). Values may exceed 2^53, which is why they are strings.

| File | `input` | `expected` |
|---|---|---|
| `orientation.jsonl` | `{ a, b, c }` three points, a ≠ b | `1` if c is left of a→b, `-1` if right, `0` if collinear (the sign of (b − a) × (c − a)) |
| `segment-intersection.jsonl` | `{ p: [p1, p2], q: [q1, q2] }` two non-degenerate closed segments | `true` when the segments share at least one point: a proper crossing, an endpoint touching the other segment anywhere (including at its endpoint), or a collinear overlap; `false` otherwise |
| `line-intersection-point.jsonl` | `{ p: [p1, p2], q: [q1, q2] }` two infinite lines, each through two distinct points | `{ x: [num, den], y: [num, den] }` the exact intersection; or `"parallel"` (distinct parallel lines) or `"coincident"` (the same line) |
| `point-in-polygon.jsonl` | `{ polygon: [v0, v1, …], point }` a simple polygon (vertices in either winding order; the last vertex joins back to the first) | `"inside"`, `"outside"`, or `"boundary"` (the point lies exactly on an edge or on a vertex) |
| `point-segment-distance.jsonl` | `{ point, segment: [a, b] }` a ≠ b | `{ d2: [num, den] }` the exact squared Euclidean distance from the point to the closed segment (nearest point may be an endpoint) |
| `perpendicular-foot.jsonl` | `{ point, line: [a, b] }` an infinite line through a ≠ b | `{ x: [num, den], y: [num, den] }` the exact foot of the perpendicular from the point onto the line |
| `polygon-area.jsonl` | `{ polygon: [v0, v1, …] }` a simple polygon | a decimal integer string: twice the signed area (positive for counter-clockwise vertex order, negative for clockwise) |
| `convex-hull.jsonl` | `{ points: [...] }` a point set that may contain duplicates and collinear runs | the hull vertices in counter-clockwise order starting at the vertex with the lowest y (ties: lowest x); points strictly between two hull vertices on a hull edge are omitted, as are duplicates |

Why these vectors exist: with every coordinate bounded by 2^25, all of the predicates above have
exact answers in integer or rational arithmetic (the largest intermediate product of two
coordinate differences is below 2^53, and rational results are carried as big integers). A router
that decides "which side", "do these touch" or "is this inside" by floating point will fail the
near-collinear and one-unit-off records in these files; see Shewchuk (1997) in `spec/glossary.md`.
