#!/bin/bash
set -eu
# Run from repository root after reproduce.py --prepare-only, before any timed run.
work=$(realpath "$1")
root=$(pwd)
python3 - "$root" <<'PYCODE'
from pathlib import Path
import json,hashlib,sys
root=Path(sys.argv[1])
p=root/'docs/pr-assets/agent-fab-router-perf-local-rescue/live-core'
for f,h in json.loads((p/'targeted-tests.json').read_text()).items():
    assert hashlib.sha256((root/f).read_bytes()).hexdigest()==h,f
PYCODE
if [ ! -e "$work/candidate/node_modules" ]; then
  ln -s "$root/node_modules" "$work/candidate/node_modules"
fi
mkdir -p "$work/candidate/test/helpers"
cp "$root/test/helpers/synth.ts" "$work/candidate/test/helpers/synth.ts"
for name in lattice.test.ts route-core.test.ts perf-invariance.test.ts; do
  cp "$root/test/$name" "$work/candidate/test/$name"
done
cd "$work/candidate"
taskset -c 12-19 nice -n 10 timeout 120 bun run typecheck
taskset -c 12-19 nice -n 10 timeout 120 bun test test/lattice.test.ts test/route-core.test.ts test/perf-invariance.test.ts
