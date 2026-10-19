#!/usr/bin/env bash
set -euo pipefail
# Invoke from the repository root. First argument must be a new directory under ~/bench.
assets="$PWD/docs/pr-assets/agent-fab-router-perf-sort"
run=${1:?Provide an unused benchmark directory}
mkdir "$run"
mkdir "$run/assets"
cp "$assets"/*.py "$assets"/*.ts "$assets"/*.dsn "$run/assets/"
assets="$run/assets"
git worktree add -b agent/fab-router-perf-sort-repro-base "$run/baseline" 69cf598
git worktree add -b agent/fab-router-perf-sort-repro-candidate "$run/candidate" c975b79
bun install --cwd "$run/baseline" --frozen-lockfile
bun install --cwd "$run/candidate" --frozen-lockfile
(cd "$run/candidate" && taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test')
taskset -c 12-19 nice -n 10 timeout 10800 python3 "$assets/paired-native.py" --benchmark-checkout /home/hyper/bench/wt/fp-perf --baseline-source "$run/baseline" --candidate-source "$run/candidate" --out "$run/cycle15-paired"
python3 "$assets/summarize-paired.py" "$run/cycle15-paired" --out "$assets"
taskset -c 12-19 nice -n 10 timeout 1800 bun "$assets/ladder-route.ts" "$run/baseline" "$run/candidate" "$assets" "$assets/ladder.json"
work=("$run"/cycle15-paired/before/paperino-hw-paperino-shield-j4/runs/*/fab-router/work)
for pair in before:1 after:1 after:2 before:2 before:3 after:3; do
 version=${pair%:*}
 repeat=${pair#*:}
 source="$run/baseline"
 if [ "$version" = after ]; then source="$run/candidate"; fi
 name="cycle15-profile-$version-$repeat"
 mkdir "$run/$name"
 taskset -c 12-19 nice -n 10 timeout 600 bun --cpu-prof --cpu-prof-dir "$run/$name" "$assets/profile-route.ts" "$source" "${work[0]}" 1 > "$run/$name.log" 2>&1
done
python3 "$assets/query-census.py" "$PWD" "$run/cycle15-census-source"
taskset -c 12-19 nice -n 10 timeout 600 bun "$assets/profile-route.ts" "$run/cycle15-census-source" "${work[0]}" 1 > "$run/cycle15-census.log" 2>&1
# Run analyzers from the original checkout so Git provenance is available.
python3 "$PWD/docs/pr-assets/agent-fab-router-perf-sort/summarize-extra.py" "$run" --out "$assets"
# With matplotlib installed:
python3 "$assets/plot.py"
