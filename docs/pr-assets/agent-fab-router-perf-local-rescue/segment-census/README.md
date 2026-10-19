# Complete-board segment threshold census

This diagnostic observes segment-core comparisons in the routing clearance module after its original distance calculation. It independently evaluates intersection and all four ordered endpoint distances, checks the threshold decision, and returns the original result. Production source and settings remain unchanged. Counts describe potential endpoint work before any production coordinate-domain guard: observer overhead, dispatch, intersection and non-segment work preclude translating them into a speed estimate.

Three complete replays of the archived input must retain the independent reference session, settings, statistics, report (except elapsed time), and recovery structure (except nested seconds). These are engine replays, without a fresh native checker or benchmark score. Known native thermal findings remain unresolved. Synthetic equivalence evidence is in `../segment-threshold/`; it is not universal proof of a production optimization. This observer does not certify the synthetic candidate’s coordinate-domain guard coverage, and it does not replace production fallback validation.

From the repository root:

```bash
p=docs/pr-assets/agent-fab-router-perf-local-rescue/segment-census
s=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle69
python3 "$p/prepare.py" "$s/work"
for r in 1 2 3; do
  taskset -c 12-19 nice -n 10 timeout 300 bun "$p/run.ts" "$s/work/source" "$s/work/input" "$s/replay$r"
done
python3 "$p/report.py" "$s" "$p"
python3 "$p/chart.py"
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Use an unused scratch path when reproducing. `records.json.gz` retains all three raw replay results and sessions. Archive verification:

```bash
python3 - <<'PY'
from pathlib import Path
import gzip, hashlib, importlib.util, json
p=Path('docs/pr-assets/agent-fab-router-perf-local-rescue/segment-census')
for name,digest in json.loads((p/'manifest.json').read_text()).items():
    assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest
spec=importlib.util.spec_from_file_location('census',p/'report.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assert m.check(json.loads(gzip.decompress((p/'records.json.gz').read_bytes())))==json.loads((p/'summary.json').read_text())
m.parity.source_check(json.loads((p/'source-audit.json').read_text()),gzip.decompress((p/'clear-observer.ts.gz').read_bytes()))
print('archive and independent parity verified')
PY
```

Any adoption requires fresh paired full 26×3 native measurements, larger boards and slow acceptance, preserving output and native quality. No optimization is adopted here.
