# Bounded repair search budget

The previous budget allowed roughly one node pop per region cell, capped at
30000. A planar search can visit a cell through several incoming directions.
On this congested ten-net connector fixture, later repair attempts repeatedly
exhausted that budget. Add opt-in `extendedSearchBudget: true` to double the cell-derived budget and
ceiling (60000), with minimums 8000 planar / 12000 layered. Defaults, clearance
and deadline checks remain unchanged.
The accompanying regression checks eight connected nets and zero internal
spacing violations. Two nets still remain open.

Same machine, cores 6–11, three repeats each, baseline `69cf598`:

| Measurement | Original default | Candidate, extended enabled |
| --- | ---: | ---: |
| L1 SRJ final opens, each run | 5 | 2 |
| L1 SRJ internal spacing violations, each run | 0 | 0 |
| L1 SRJ median engine seconds | 12.893 | 14.556 |
| Native solenoid case valid runs | 3/3 | 3/3 |
| Native opens / new DRC errors, each run | 0 / 0 | 0 / 0 |
| Native route median seconds | 0.823 | 0.792 |
| Native route length mm, each run | 352.691 | 358.771 |
| Native vias, each run | 12 | 12 |

The final candidate with extended search disabled also passes the native case
3/3, retaining the original 352.691mm and 12 vias (median 0.850s).
This improves connector completion at a runtime cost when explicitly enabled. Native wire length rises
1.7%; no full-suite or overall performance gain is claimed. Native checks used
stock KiCad 10.0.6 and the unchanged frozen standalone checker. Timing runs shared
the assigned cores with checks; no precise performance claim is warranted.
The SRJ fixture is MIT licensed (adjacent LICENSE), unchanged SHA256
`7d78278ddd9abcdc02e5628de77ebf09ebbdc84928a1c3a07015e877395f7b37`.
Engine licence remains GPL-3.0. No installation or pinned dependency changes.
A first experiment changed the default and failed the existing issue026-j2
fingerprint regression (859 pass, 1 fail). That experiment was rejected; the
fingerprint assertion remains unchanged. The final option is off by default.

Reproduce from the engine repository root, with baseline in a separate checkout:

```sh
bun install --frozen-lockfile
nice -n 10 taskset -c 6-11 timeout 180 bun docs/pr-assets/agent/repair-search-budget/measure.ts /path/to/baseline docs/pr-assets/agent/repair-search-budget/before.json
nice -n 10 taskset -c 6-11 timeout 180 bun docs/pr-assets/agent/repair-search-budget/measure.ts . docs/pr-assets/agent/repair-search-budget/after.json extended
bun run typecheck
bun run check:layers
nice -n 10 taskset -c 6-11 timeout 600 bun run test
python3 docs/pr-assets/agent/repair-search-budget/render.py
```

From a separate native benchmark checkout with its verified runtime installed:

```sh
nice -n 10 taskset -c 6-11 timeout 300 python3 benchmarks/autorouter/benchmark.py --router fab-router --case kitspace-solenoid-driver-j1 --fab-router-source /path/to/baseline --out /tmp/native-before
nice -n 10 taskset -c 6-11 timeout 300 python3 benchmarks/autorouter/benchmark.py --router fab-router --case kitspace-solenoid-driver-j1 --fab-router-source /path/to/candidate --out /tmp/native-after
```

Reproduce the enabled native mode from the engine checkout:

```sh
python3 docs/pr-assets/agent/repair-search-budget/make-config.py /path/to/native-checkout/benchmarks/autorouter /tmp/extended-configs
cd /path/to/native-checkout
nice -n 10 taskset -c 6-11 timeout 300 python3 benchmarks/autorouter/benchmark.py --router fab-router --case kitspace-solenoid-driver-j1 --fab-router-source /path/to/candidate --config-dir /tmp/extended-configs --out /tmp/native-extended
```

Raw results retain every repeat; native checks are in `native-before.json` and
`native-after.json`. Diagnostics that motivated this change were isolated from
these uninstrumented measurements.

![Bounded search comparison](https://github.com/fabPlane/fab_router/blob/agent/repair-search-budget/docs/pr-assets/agent/repair-search-budget/budgets.png?raw=true)

Validation: typecheck passes; check:layers reports 65 files and zero violations;
full engine suite passes 860/860 with 398457 assertions (230.47s), including the
unchanged issue026-j2 fingerprint and the new opt-in connector regression.
