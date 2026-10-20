# Full-context coordinated power-via diagnostic

Same retained placement-corrected Aquarius board, three fresh paired native
checks on cores 20–25. No production routing or search code changed.

| Geometry | Native errors | Opens | Lost source pairs | Lost current pairs | Relative / final acceptance |
|---|---:|---:|---:|---:|---|
| Before | 6 thermal | 13 | 235 | 0 | true / false |
| Power via alone | 5 thermal + 3 clearance | 14 | 292 | 57 | false / false |
| Coordinated power + signal vias | 5 thermal | 13 | 235 | 0 | true / false |

The power via moves from (164.1045,50.6008) to (163.8045,50.9008) mm.
The lower signal via moves from (163.3455,51.5585) to (163.3455,52.0785) mm.
All incident generated track endpoints move with each via. Native ownership is
preserved. The original source and all rules remain byte exact. The control
contains all 468 generated items after the previously retained detour.
Final acceptance rejects all geometries: five thermals and 235 lost source pairs
remain. No final board bundle is published. This is a manual diagnostic,
not a generated recovery, complete repair or scored routing improvement.
The new test asserts the existing native behavior; no fail-first fix is claimed.

54 exploratory native checks are retained, including rejected corner/via/detour
trials and deletion-only diagnostic controls. None are scored routes. Increasing
the signal via y by 0.50 mm still loses 57 current pairs; +0.52 to +0.57 mm restores
them without added errors; +0.60 mm adds a clearance to the long LED track.
A deletion control isolates the short power-via exit track as one corridor cut.

Latest complete scored corpus is retained from c219, not rerun for this
fixture/test-only change: default 39/78, 13/26 valid, 120 opens, 27 thermals
(c217); opt-in 45/78, 15/26 valid, 120 opens, 18 thermals (c219).
This diagnostic does not alter either score or the integration pin.

From this repository root:

```bash
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c220-joint-power/native-evidence.tar.xz -C /tmp
python3 /tmp/c220/verify.py
taskset -c 20-25 nice -n 10 bun test test/native-aquarius-joint-power.test.ts
# Use a fresh directory for another three-repeat measurement:
mkdir /tmp/c220-recheck
taskset -c 20-25 nice -n 10 timeout 600 bun /tmp/c220/measure.ts /tmp/c220-recheck
bun run typecheck && bun run check:layers && bun run test
```

The archive contains submitted/native-saved boards, rules, terminal groups,
reports, logs, control inputs and portable exploratory scripts. MIT source-board
license remains in test/fixtures/native-aquarius-thermal/LICENSE.

Validation: typecheck and layer checks pass (65 files, zero violations);
934 tests pass, zero failures, 399001 assertions, 1031.85 seconds.
New focused regression: 17 assertions, 35.67 seconds standalone.
