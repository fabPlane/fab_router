#!/usr/bin/env bash
set -euo pipefail
# CONTROL_SOURCE must be an own checkout with control src/spec at 69cf598.
# PRIOR_CONTROL is cycle17-paired/before (26 case subdirectories, three repeats each).
: "${CONTROL_SOURCE:?}" "${BENCHMARK_CHECKOUT:?}" "${PRIOR_CONTROL:?}" "${RUN_ROOT:?}"
assets=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mkdir "$RUN_ROOT"
python3 "$assets/grid-census.py" "$CONTROL_SOURCE" "$RUN_ROOT/source"
python3 "$assets/audit-grid-source.py" "$CONTROL_SOURCE" "$RUN_ROOT/source" "$RUN_ROOT/source-audit.json"
git -C "$RUN_ROOT/source" init -q -b agent/fab-router-perf-census-diagnostic
git -C "$RUN_ROOT/source" add src spec package.json tsconfig.json census-provenance.json
git -C "$RUN_ROOT/source" -c user.name='Benchmark Agent' -c user.email='benchmark-agent@users.noreply.github.com' commit -qm 'Instrument search grid budgets for diagnostic measurement'
(
 cd "$BENCHMARK_CHECKOUT"
 taskset -c 12-19 nice -n 10 timeout 5400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$RUN_ROOT/source" --out "$RUN_ROOT/native-complete"
)
python3 "$assets/summarize-grid-census.py" "$PRIOR_CONTROL" "$RUN_ROOT/native-complete" "$RUN_ROOT/source" "$RUN_ROOT/report"
# Use an environment with matplotlib installed to render the engineering plot.
python3 "$assets/plot-grid-census.py" "$RUN_ROOT/report"
for case in paperino-hw-paperino-shield-j4 rufs-smart-psu-j3 photon-sprinkler-sprinkler-j3; do
 work_dirs=("$PRIOR_CONTROL/$case/runs/"*/fab-router/work)
 taskset -c 12-19 nice -n 10 timeout 600 bun "$assets/residual-grid.ts" "$CONTROL_SOURCE" "${work_dirs[0]}" "$RUN_ROOT/report/residual-$case.json"
done

python3 "$assets/correlate-grid-residuals.py" "$RUN_ROOT/report"
