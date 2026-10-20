#!/bin/bash
set -eu
cd /home/hyper/bench/wt/fr-perf
taskset -c 12-19 nice -n 10 timeout 120 bun run typecheck
taskset -c 12-19 nice -n 10 timeout 120 bun run check:layers
taskset -c 12-19 nice -n 10 timeout --kill-after=5 1200 bun run test
