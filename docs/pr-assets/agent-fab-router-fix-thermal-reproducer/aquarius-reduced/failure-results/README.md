# Preserve unexpected offline generation failures

The offline search caught every `ValueError` raised while generating proposals as
unsupported metadata. A malformed geometry failure could therefore appear as an
exhausted search. Catch only `UnsupportedMetadata`; translate the known ambiguous
plane and insufficient search-scale conditions at the native metadata boundary.
Unexpected generation failures now propagate. Native transaction guards remain
unchanged. This is diagnostic work, not a production routing repair.

Regression added before implementation. Identical 13 controls, same host
hyper-ms-lin, cores 20–25, three repeats per source:

| Diagnostic control measurement | Before 39fd091 | After |
|---|---:|---:|
| Passing controls per repeat | 11/13 | 13/13 |
| Unexpected generation ValueError | recorded as skip | propagates |
| Explicit unsupported metadata | missing exception class | recorded as skip |

The before failure count includes the new explicit exception contract. Native DRC
is mocked in these controls; no fresh native or router benchmark was run. The
historical full-suite reference remains 39/78 passing runs, 13/26 valid cases,
120 opens, 27 new thermal errors. Production routing remains unresolved.

From repository root:

```sh
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
taskset -c 20-25 nice -n 10 timeout 180 /usr/bin/python3 -B "$A/failure-results/compare.py"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Diagnostic controls](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/failure-results/comparison.png?raw=true)

Required checks: typecheck PASS; layers 65 files/zero violations; 859 tests
PASS, zero failures, 398454 assertions (210.97 seconds).
