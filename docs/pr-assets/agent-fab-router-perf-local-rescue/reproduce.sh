#!/usr/bin/env bash
set -euo pipefail
# BASELINE_SOURCE: own checkout at 69cf598; CANDIDATE_SOURCE: own checkout at 4821f12.
# BENCHMARK_CHECKOUT: installed standalone benchmark checkout; RUN_ROOT: unused directory.
: "${BASELINE_SOURCE:?}" "${CANDIDATE_SOURCE:?}" "${BENCHMARK_CHECKOUT:?}" "${RUN_ROOT:?}" "${DENSE_CASE:?}"
asset_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mkdir "$RUN_ROOT"
run() { taskset -c 12-19 nice -n 19 timeout "$@"; }
python3 "$asset_dir/make-config.py" "$BENCHMARK_CHECKOUT/benchmarks/autorouter" "$RUN_ROOT/config"
run 10800 python3 "$asset_dir/paired-native.py" --benchmark-checkout "$BENCHMARK_CHECKOUT" --baseline-source "$BASELINE_SOURCE" --candidate-source "$CANDIDATE_SOURCE" --candidate-config "$RUN_ROOT/config" --out "$RUN_ROOT/cycle17-paired"
python3 "$asset_dir/summarize-native.py" "$RUN_ROOT/cycle17-paired" "$RUN_ROOT/report"
run 120 bun "$asset_dir/fixture-route.ts" "$CANDIDATE_SOURCE" "$RUN_ROOT/fixture.json"
for file in l2.dsn l3-cycle18.dsn; do
 for repeat in 1 2 3; do
  versions='before after'
  if [[ "$repeat" = 2 ]]; then versions='after before'; fi
  for version in $versions; do
   source_dir=$BASELINE_SOURCE; mode=off
   if [[ "$version" = after ]]; then source_dir=$CANDIDATE_SOURCE; mode=on; fi
   run 180 bun "$asset_dir/large-route.ts" "$source_dir" "$mode" "$asset_dir/$file" "$RUN_ROOT/cycle17-large-$file-$version-$repeat.json"
  done
 done
done
run 2400 python3 "$asset_dir/dense-native.py" "$BENCHMARK_CHECKOUT/benchmarks/autorouter" "$BASELINE_SOURCE" "$CANDIDATE_SOURCE" "$DENSE_CASE" "$RUN_ROOT/cycle17-dense-native"
run 120 bun "$asset_dir/dense-session-order.ts" "$BASELINE_SOURCE" "$RUN_ROOT/cycle17-dense-native" "$RUN_ROOT/report/dense-session-order.json"
for repeat in 1 2 3; do
 versions='before after'
 if [[ "$repeat" = 2 ]]; then versions='after before'; fi
 for version in $versions; do
  source_dir=$BASELINE_SOURCE
  if [[ "$version" = after ]]; then source_dir=$CANDIDATE_SOURCE; fi
  work_dirs=("$RUN_ROOT/cycle17-paired/$version/paperino-hw-paperino-shield-j4/runs/"*/fab-router/work)
  profile_dir="$RUN_ROOT/cycle17-profile-$version-$repeat"
  mkdir "$profile_dir"
  run 600 bun --cpu-prof --cpu-prof-dir "$profile_dir" "$asset_dir/profile-route.ts" "$source_dir" "${work_dirs[0]}" 1 > "$RUN_ROOT/cycle17-profile-$version-$repeat.log" 2>&1
 done
done
python3 "$asset_dir/summarize-extra.py" "$RUN_ROOT" "$RUN_ROOT/report"
