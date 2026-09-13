# `src/geom` — geometry kernel

Integer-LU points, exact predicates, squared distances between the shape kinds of
`docs/DESIGN.md` §1, bounds (box / 8-DOP), Minkowski expansion, convex decomposition, path
shaping and exact rational constructions. Pure functions over plain objects, no classes, nothing
imported from above this layer. Literature (cited in each module header): Shewchuk 1997 (why
predicates must be exact), Andrew 1979 (monotone chain), Meisters 1975 + Hertel–Mehlhorn 1983
(ear clipping and convex merge), Klosowski et al. 1998 (k-DOPs).

| Module | Contents |
|---|---|
| `types.ts` | `Pt`, `Seg`, `Box`, `Dop8`, `Ring`, the tagged `Shape` union, `MAX_COORD` |
| `predicates.ts` | `cross`, `dot`, `orient`, `side`, `onSeg`, `segsIntersect`, `pointInConvex`, `pointInRing` |
| `hull.ts` | `hullOf` (monotone chain), `area2`, `isCcw`, `isConvexCcw` |
| `distance.ts` | `dist2` over every shape pair through one convex-core rule; `dist2PtSeg`, `dist2SegSeg`, … |
| `bounds.ts` | `boxOf*`, `dop8Of*`, `dop8Intersects`, `dop8ToHull`, `octagon`, `expand(shape, r, "dop8" \| "euclid")` |
| `pieces.ts` | `cleanRing`, `convexPieces` (ear clip + Hertel–Mehlhorn) |
| `path.ts` | `simplifyCollinear`, `snap45`, `stairs90`, `bendKind`, `bendAngleDeg`, `pathLength` |
| `rational.ts` | bigint exact fractions: line intersection, perpendicular foot, point–segment distance, area |

## The 2^25 bound and why float64 is exact

Every stored coordinate is an integer with `|x|, |y| ≤ 2^25` (`MAX_COORD`). The Frame chooses the
layout unit so that this holds (`docs/DESIGN.md` §1). Consequences, all in plain float64:

- A coordinate difference is an integer of magnitude ≤ 2^26.
- A product of two differences is an integer of magnitude ≤ 2^52.
- A sum or difference of two such products is an integer of magnitude ≤ 2^53.

float64 represents every integer of magnitude ≤ 2^53 exactly and integer addition, subtraction
and multiplication whose true result fits are performed exactly (IEEE 754 round-to-nearest of an
exactly representable value is the value itself). Hence:

- `cross(a, b, c) = (bx−ax)(cy−ay) − (by−ay)(cx−ax)` is exact, so `orient`, `side`, `onSeg`,
  `segsIntersect`, `pointInConvex` and `pointInRing` are exact decisions.
- `dot` is exact for the same reason, so the "nearest point is an endpoint" tests in the segment
  distances are exact, and so is the squared distance between two points (≤ 2·2^52 = 2^53).
- A doubled triangle area is exact; `area2` sums doubled fan-triangle areas, so a polygon's
  doubled area is exact whenever every partial fan sum stays within 2^53 in magnitude — always
  true for convex polygons and for any polygon whose fan sub-polygons do not wind more than
  once around a region (the doubled area of anything inside the coordinate square is ≤ 2^53).
  `rational.ts` has the bigint form for the pathological remainder.

What is **not** exact in float64: constructions whose true result is a rational number — the
interior case of a point–segment distance (`cross² / len²`), a line intersection point, a
perpendicular foot. The kernel computes those as float64 approximations (relative error a few
ulp), and the code that consumes them snaps to integer LU with direction-aware rounding:
clearance expansions round outward, path points round to nearest. The ≤ 0.5 LU snapping error is
orders of magnitude below any spacing rule and the final DRC comparison is redone with the exact
predicates. `rational.ts` gives the exact reduced fraction (bigint) for verification and for any
caller who wants an exact final check; it is not used on the router's hot path.

## Shapes

A *convex shape* is a convex core — a point, a segment, or a CCW convex polygon — plus a radius:
`disk` (point + r), `capsule` (segment + r), `box`, `hull` (polygon, r = 0), `rounded` (polygon +
r). `pieces` is a union of convex shapes, the output of `convexPieces`. One rule gives every
distance: `dist(A, B) = max(0, dist(coreA, coreB) − rA − rB)`, and `sqrt` is taken only when a
radius is involved.

`expand(shape, r, "dop8")` is the Minkowski sum with the integer octagon `octagon(r)` — vertices
`(±r, ±t)`, `(±t, ±r)`, `t = ⌈r·tan 22.5°⌉` — whose apothem is ≥ r, so the result contains the
Euclidean expansion: conservative for the router. `expand(shape, r, "euclid")` is the exact rounded
shape for DRC. `dop8Of` bounds the Euclidean expansion in the x, y, x+y and x−y directions with
outward rounding.
