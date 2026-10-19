# Cross-board validation of marker-driven thermal search

The current marker-driven selector had been measured on Aquarius. Fresh native
checks now exercise it on the complete J2small witness: the intact original input
plus all nine generated copper additions from the earlier measured route. All 178
original copper items remain protected. Source, input and rule-sidecar bytes come
from the earlier complete-search archive; no causal identifiers are supplied.

Eight marker-ranked items yield two single-deletion causes. On the complete board,
deletions introduce opens and are rejected as repairs. Endpoint-preserving single
track detours remove the U1.7 error first, then U2.15. This corrects the earlier
triage assumption that this witness still requires connected-pair integration:
the current single-track detour family is sufficient on this source. It does not
establish sufficiency on other geometries.

The attempted connected-pair extension was not adopted. Two preliminary three-repeat
arms (single-only versus extension enabled) produced identical proposal sequences
and selected bytes; the pair fallback was never reached. Their code, failing/passing
new-tool tests and 114 native checks are retained privately under the cycle scratch
directory, excluded from the published measurement below. A fresh execution of the
existing selector through the small wrapper in this directory supplies the public
results. No search, acceptance, engine or adapter logic changes in this update.

Same source/input/rules and machine `hyper-ms-lin`, cores 20–25, native 10.0.6;
three independent native repeats per configuration:

| Offline configuration | Source errors / opens | Selected errors / opens | Repeats |
| --- | ---: | ---: | ---: |
| Earlier composed single/pair search (c175) | 2 / 0 | 0 / 0 | 3 |
| Current marker-driven single-track search | 2 / 0 | 0 / 0 | 3 |

The public run has 57 native checks: 3 baselines, 24 deletion hypotheses and 30
repair attempts. All are retained, including rejected proposals. All 57 saved boards faithfully
retain their proposed designs. Aggregate diagnostic totals are 111 errors and 30
opens across baselines/probes/attempts, rather than router scores. Independent replay
reconstructs each proposal and checks source metadata/original copper, saved design
identity, rule sidecars, full error multisets, terminal partitions, strict sequential
acceptance and final publication. Every accepted stage retains all terminal pairs,
adds no opens and strictly reduces errors. Final bytes repeat three times.

This is offline native evidence, not a production repair or scored router gain.
The 26-case × three-seed suite was not rerun: recorded production results remain
39/78 passes, 13/26 valid cases, 120 opens and 27 new thermal errors. Production
native validation and atomic recovery remain unresolved. No pin bump is justified.

Validation passes: typecheck, layer checks (65 files, zero violations), 859 engine
tests (398454 assertions, 267.04 seconds), and 21 inherited offline tests.
Original and extracted-archive replay results accompany the evidence.

The source provenance and board license are retained in
[the causal witness evidence](../c165-thermal-causes/README.md) and
[its license](../c165-thermal-causes/LICENSE). Disposable native copies are archived;
frozen inputs, checker/scoring and shared runtime are untouched.

Reproduce from the repository root, using fresh output directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/j2-generalization-archive
tar -xJf "$R/c186-j2-generalization/native.tar.xz" -C /tmp/j2-generalization-archive
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c186-j2-generalization/verify.py" --root /tmp/j2-generalization-archive/evidence
# Reconstruct the same complete source and original input from the earlier archive.
/usr/bin/python3 -B "$R/c186-j2-generalization/prepare.py" --out /tmp/j2-generalization-fresh
taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 -B "$R/c186-j2-generalization/measure.py" --source /tmp/j2-generalization-fresh/original-segment/board.kicad_pcb --input /tmp/j2-generalization-fresh/original-input/board.kicad_pcb --out /tmp/j2-generalization-fresh/evidence
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/c186-j2-generalization/verify.py" --root /tmp/j2-generalization-fresh/evidence
/usr/bin/python3 -B "$R/c186-j2-generalization/render.py" --root /tmp/j2-generalization-fresh/evidence --out /tmp/j2-generalization-fresh/comparison
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Fresh J2small native stages](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c186-j2-generalization/comparison.png?raw=true)
