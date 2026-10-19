# Full native failure refresh

Cycle 133 reruns the unchanged engine against all 26 frozen cases, three repeats
per case, on the same host as the completed October 18 reference. This is a
reproducibility and failure-triage measurement, not a production fix. Offline
thermal proposals are not applied to any benchmark output.

The reference used cores 26–29; this run uses cores 20–25. Route times are
descriptive only. Input, harness, runtime and common router configuration hashes
must match after checkout-root normalization of the router config. All 65 captured production TypeScript files must match the reference
runtime. The comparison checks every case/seed and preserves failures.

`comparison.json` contains the before/after totals, all 26 case outcomes, native
thermal findings, evidence hashes and any differences in pass status, opens,
error types, fidelity, via counts or copper length. `evidence.tar.gz` retains the
original controls, results and summaries for independent replay. Full boards
remain in the agent's benchmark results directory.

Run from the integration repository, with a new output directory:

```sh
timeout 2400s taskset -c 20-25 nice -n 10 python3 benchmarks/autorouter/benchmark.py \
  --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs \
  --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c133/native-full
```

Run from the engine repository to compare retained evidence:

```sh
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c133-native-refresh
D=$(mktemp -d /tmp/native-refresh-XXXXXX)
tar -xzf "$A/evidence.tar.gz" -C "$D"
python3 "$A/compare.py" --before "$D/before" --after "$D/after" --out "$D/comparison.json"
cmp "$A/comparison.json" "$D/comparison.json"
```

Validation from the engine repository:

```sh
timeout 1200s taskset -c 20-25 nice -n 10 bash -c \
  'bun run typecheck && bun run check:layers && bun run test'
```

The live adapter remains a separate ownership problem: dangling-copper validation
uses DRC without refill; refill happens afterward and failure is non-fatal.
This offline audit neither changes that boundary nor establishes atomic safety.

| Metric | Reference | Refresh |
| --- | ---: | ---: |
| Passing runs | 39/78 | 39/78 |
| Cases valid 3/3 | 13/26 | 13/26 |
| Native opens | 120 | 120 |
| New thermal errors | 27 | 27 |

All 78 pass/open/error/fidelity/via/length outcomes match. Required checks pass:
859 tests, zero failures; typecheck and 65-file layer check pass. No production
fix or routing improvement is claimed.

| Thermal case | Errors per repeat | Opens per repeat | Native pad findings |
| --- | ---: | ---: | --- |
| kitspace-aquarius-j4 | 6 | 15 | C1.2, R20.1, U1.39, U1.46, U1.48, U1.53 |
| qrpcard-qrpcard-j2-small | 2 | 0 | U1.7, U2.15 |
| qrpcard-qrpcard-j4 | 1 | 0 | U2.15 |

The first case involves the back copper ground zone; the other two involve the
front copper ground zone. The native checker reports starved thermal connections
in all nine failing runs. These are exact native findings, not a diagnosis of the
remaining opens. No crash, timeout or new fidelity failure occurred.

Regenerate the chart with `python3 "$A/chart.py"`, then
`rsvg-convert -w 1600 "$A/comparison.svg" -o "$A/comparison.png"`.
