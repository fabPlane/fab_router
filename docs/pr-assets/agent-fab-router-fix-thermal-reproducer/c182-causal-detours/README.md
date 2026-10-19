# Complete-board causal thermal detours

Four causal tracks missed by global ranking have endpoint-preserving native-safe
detours on the complete Aquarius output. The bounded generator includes horizontal
and vertical tracks, which the earlier chamfer generator skipped. It preserves the
original endpoints, net, layer and width and replaces one generated track with
three tracks. Each cause is measured separately; discovery still uses the explicit
copper census from [cycle 178](../c178-causal-tracks/README.md).

The four individually accepted detours are then revalidated sequentially on a
fresh disposable complete board, together with the earlier connected via move
and deletion of the redundant U1.39 track. Every step requires a strict subset of
native errors, faithful proposed/saved design identity, identical terminal inventory,
no lost terminal pairs, and no increase in opens. A rejected step retains the exact
preceding bytes. Selected boards are diagnostic artifacts; no benchmark inputs,
checker, editor state, engine or adapter are changed.

Same source, rules, machine `hyper-ms-lin`, cores 20–25 and native 10.0.6; three
fresh refills per configuration, not router seeds:

| Configuration | Before errors / opens | After errors / opens | Repeats |
| --- | ---: | ---: | ---: |
| R20.1, +0.5 mm perpendicular detour | 6 / 15 | 5 / 15 | 3 |
| U1.46, −0.25 mm detour | 6 / 15 | 5 / 15 | 3 |
| U1.48, −0.25 mm detour | 6 / 15 | 5 / 15 | 3 |
| U1.53, −0.5 mm detour | 6 / 15 | 5 / 15 | 3 |
| U1.39, eight offsets | 6 / 15 | No accepted detour | 3 |
| Sequential combination, including via move and redundant-track deletion | 6 / 15 | 0 / 14 | 3 |

Four proposals per repeat fail saved-design identity and are excluded from faithful
design outcomes; their reports and exact proposed/saved bytes remain archived.
The independent verifier checks every proposal's unaffected nodes, copper properties,
endpoint chain, saved design, native error findings, rule sidecars, terminal partitions
and strict acceptance decision. The composition verifier checks every intermediate
and final publication. Identical selected bytes across repeats are required.

The retained measurements comprise 81 native checks: 60 separate-cause checks
and 21 sequential checks. Of these, 69 preserve design identity and 12 are rejected
for drift. The faithful controls and rejected proposals total 447 errors and 1023
opens; these aggregates are diagnostics, not suite scores. Thirty intermediate
transactions pass policy; three final combined boards have zero errors.

An initial exploratory run used eight fractional decimal places in millimetres;
native save quantized those coordinates, so the unchanged identity guard rejected
them. That run was stopped, retained privately and excluded. Final proposals use
six fractional places (integer nanometres). A serializer regression fails with the
earlier precision and passes with the correction. One composition verifier was
started before the third independent repeat had been written; it failed on missing
evidence. The completed archive is verified afresh; no native check was rerun or
excluded for that verifier timing error. The initial geometry test failed
because the new helper was absent. These are offline-tool tests, not engine regressions.

This is an offline, cause-guided repair witness, **not a production fix or scored
router gain**. Fourteen native opens remain. The historical full 26-case × 3-seed
suite remains 39/78 passes, 13/26 valid cases, 120 opens and 27 added thermal errors;
it was not rerun with this diagnostic. Engine typecheck, layer checks and all
859 tests (398454 assertions) pass; the engine files are unchanged. Production native-aware recovery, bounded
cause discovery and atomic editor integration remain unimplemented. No pin bump.
Provenance and license: [complete source provenance](../c176-aquarius-search/README.md)
and [input license](../aquarius-reduced/LICENSE).

Reproduce from the repository root with fresh directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c182-causal-detours
mkdir -p /tmp/causal-detours
tar -xJf "$R/native.tar.xz" -C /tmp/causal-detours
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/verify.py" --root /tmp/causal-detours/evidence
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/verify_composed.py" --root /tmp/causal-detours/evidence
/usr/bin/python3 -B "$R/test_geometry.py"
/usr/bin/python3 -B "$R/test_proposals.py"
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 -B "$R/probe.py" --previous /tmp/causal-detours/evidence --out /tmp/causal-detours/fresh
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/compose.py" --root /tmp/causal-detours/fresh
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Complete-board causal detour outcomes](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c182-causal-detours/comparison.png?raw=true)

The current via helper requires original-copper ownership and preserves foreign-net
tracks at coincident endpoints. See [ownership regression and fresh native comparison](../c183-via-ownership/README.md). Historical measurements above remain unchanged.
