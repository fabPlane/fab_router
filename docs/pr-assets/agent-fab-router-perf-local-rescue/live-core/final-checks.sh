#!/bin/bash
set -eu
taskset -c 12-19 nice -n 10 timeout --kill-after=10 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
