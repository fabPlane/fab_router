# Completed baseline failure triage

Read-only comparison of existing results; no new router run or production fix.
The shared baseline finished all 390 planned runs. Its 78 fab_router runs match the independent
cycle-136 sweep on status, pass, opens, new error counts/types, fidelity, via counts and track length.
All native error witnesses (including descriptions and pad/zone identities) also match.
Both used native checker 10.0.6 on the same host, 26 cases and three repeats. Timing is excluded.

| Measurement | Independent sweep | Completed shared baseline |
|---|---:|---:|
| Passed runs | 39/78 | 39/78 |
| Cases passing 3/3 | 13/26 | 13/26 |
| Opens | 120 | 120 |
| New native errors | 27 | 27 |
| Runs with new errors | 9 | 9 |

All repeats have the same counts below. New errors are all `starved_thermal`.
The six-error case also has 15 opens per run; classification prioritizes native errors.
No crash, timeout, or fidelity failures occur. The other 30 failed runs have opens only.
The reason each open is blocked is **not established** by these native reports.

| Case | Opens per repeat | New thermal errors per repeat |
|---|---:|---:|
| fan-controller-fan-controller-j1 | 5 | 0 |
| fan-controller-fan-controller-j2-small | 1 | 0 |
| hellscribe-hellscribe-j1 | 3 | 0 |
| hellscribe-hellscribe-j2-large | 1 | 0 |
| kitspace-aquarius-j4 | 15 | 6 |
| nextbusclock-nextbusclockv1-j3 | 3 | 0 |
| paperino-hw-paperino-shield-j4 | 6 | 0 |
| photon-sprinkler-sprinkler-j1 | 2 | 0 |
| photon-sprinkler-sprinkler-j3 | 2 | 0 |
| qrpcard-qrpcard-j2-small | 0 | 2 |
| qrpcard-qrpcard-j4 | 0 | 1 |
| rufs-smart-psu-j3 | 1 | 0 |
| rufs-smart-psu-j4 | 1 | 0 |

`triage.json` retains all nine native error witnesses, including pad/zone UUIDs,
coordinates, descriptions and seeds. It records SHA-256 hashes for both sets of source
results/summary/controls. It does not publish unrelated engines' data.
`audit-controls.json` records missing-run rejection, changed-open detection and identical-run controls.
The script requires completed, non-smoke, control-preserved data and exactly 26 engine cases
with seeds 1/2/3. It permits a single-router sweep (`full_suite` is multi-router only).

Reproduce from the repository root on this host:

```sh
python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c141-fresh-triage/triage.py \
  /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c136/native-full \
  /home/hyper/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018 > /tmp/fresh-triage.json
python3 -B docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c141-fresh-triage/audit-controls.py /home/hyper/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018
cmp /tmp/fresh-triage.json docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c141-fresh-triage/triage.json
rsvg-convert docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c141-fresh-triage/triage.svg -o /tmp/triage.png
```

No new history row: neither source run is being rerun or credited again.
Native thermal repair and atomic editor rollback remain unresolved.

Validation: typecheck PASS, layer checks 65 files/zero violations, 859 tests PASS/zero failures (213.00 seconds). Full log: `checks.log`. Engine source unchanged.
