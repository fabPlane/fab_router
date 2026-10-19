# Reject source metadata edits at the offline native validation boundary

The offline validator compared a proposal with the native saved board, but did not
compare protected proposal metadata with its source. Native fidelity proves that
the checker examined the proposed design; it does not authorize changes to that
design. A proposal could alter footprints, pads, zone rules, net declarations or
outlines and then pass the error/connectivity policy. Seven of nine new boundary
regressions fail against the byte-exact old implementation; all nine pass now.

`checked_native` now compares source metadata before native execution. Only
top-level segments and vias are excluded from this comparison. Footprints/pads,
zone rules and outlines, nets, graphics and other board settings must remain
unchanged. Existing design normalization permits numeric formatting and derived
zone fills. The existing proposal/saved identity and rule-sidecar checks remain.
Candidate copper ownership still requires the separate original-copper guards;
this metadata check does not authorize arbitrary copper changes.

A fresh native adversarial control takes the valid complete-board repaired copper
and also changes one original footprint reference. The old validator faithfully
checks and publishes that unauthorized proposal three times. The guarded validator
rejects before native execution and restores the exact initial source three times.
The retained reports independently establish that the old accepted proposal has
zero errors, 14 opens, and unchanged terminal partitions; favorable counts alone
cannot authorize source metadata changes.

Same complete Aquarius source, rules, native 10.0.6 and machine `hyper-ms-lin`,
cores 20–25, three complete sequences per validator; these are native refills,
not router seeds:

| Configuration | Initial errors / opens | Selected errors / opens | Repeats | Unauthorized reference edit accepted |
| --- | ---: | ---: | ---: | ---: |
| Previous proposal/saved check | 6 / 15 | 0 / 14 | 3 | 3/3 |
| Source metadata plus proposal/saved checks | 6 / 15 | 0 / 14 | 3 | 0/3 |

All six legitimate candidate stages and selected bytes are identical before/after.
The independent verifier checks protected original source nodes and source
metadata, proposal/saved design identity, rule files, native findings, terminal
partitions and selection policy. There are 45 measured native checks: 42 legitimate
sequence checks plus three old-validator adversarial checks. Their aggregate
126 errors and 666 opens include controls/intermediates, not benchmark scores.
The guarded adversarial proposals never invoke native execution.

Required checks pass: typecheck, 65 layer checks with zero violations, and
859 engine tests (398454 assertions, 227.37 seconds). The nine boundary tests
and nine inherited orchestration/ownership tests pass.

This fixes an offline validation bug. Production engine and adapter behavior are
unchanged. The 26-case × three-seed router benchmark was not rerun; its recorded
summary remains 39/78 passes, 13/26 valid cases, 120 opens and 27 added thermal
errors. Fourteen opens remain on the repaired Aquarius board. No production gain,
production safety guarantee or integration pin bump is claimed.

The archived old validator is only for controlled comparison. Measurement used
the unchanged c183 sequence runner; this directory retains that runner with an
explicit `--before` option for replay. Earlier archives and measurement-time
hashes remain historical evidence. The current source hash inventory identifies
the new dependency versions. Provenance/license: [source](../c176-aquarius-search/README.md),
[input license](../aquarius-reduced/LICENSE).

Reproduce from the repository root in a fresh disposable directory:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/source-metadata-guard
tar -xJf "$R/c184-source-guard/native.tar.xz" -C /tmp/source-metadata-guard
# Expected failure: seven regressions against the archived old validator.
/usr/bin/python3 -B "$R/c184-source-guard/test_source.py" --before
/usr/bin/python3 -B "$R/c184-source-guard/test_source.py"
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c184-source-guard/verify.py" --root /tmp/source-metadata-guard/evidence
# Remove only generated outputs in this disposable extracted directory.
rm -r /tmp/source-metadata-guard/evidence/before/composed /tmp/source-metadata-guard/evidence/after/composed /tmp/source-metadata-guard/evidence/metadata-control
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c184-source-guard/measure.py" --before --root /tmp/source-metadata-guard/evidence/before --helper "$R/c181-via-displacement/geometry.py"
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c184-source-guard/measure.py" --root /tmp/source-metadata-guard/evidence/after --helper "$R/c181-via-displacement/geometry.py"
taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 -B "$R/c184-source-guard/probe_metadata.py" --root /tmp/source-metadata-guard/evidence
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c184-source-guard/verify.py" --root /tmp/source-metadata-guard/evidence
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Source metadata guard preserves legitimate native repair](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c184-source-guard/comparison.png?raw=true)
