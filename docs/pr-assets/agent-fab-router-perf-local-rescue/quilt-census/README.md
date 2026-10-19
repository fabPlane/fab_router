# Complete-board quilt cache census

This diagnostic follows the historical expansion-profile partition. A scratch-only observer counts quilt creation, cache lookups by outcome, misses by decision, and invalidation work. Existing key construction, lookup, point-clearance calls, writes, early returns and invalidation decisions retain their order. The only changed engine module is `src/route/quilt.ts`; all 1,536 implementation/spec/test hashes are compared with the independent archived control. Production source, recovery default and consumer pin are unchanged.

Three sequential complete-board replays use the archived input and enabled recovery settings on cores 12–19, nice 10, with individual 300-second timeouts. Each must match the independent control session, settings, final statistics and report except elapsed time, and recovery structure except nested seconds. Counters must agree across all repeats and reconcile lookups and invalidation accounting. Six deliberate record corruptions and four independent source corruptions exercise the verifier. A separate hand-counted stub-clearance control exercises free/blocked hits, misses, nine attempted deletions with four removals, full clearing and empty invalidation; this control checks accounting, not geometry. Counts aggregate all route phases; they do not isolate the sampled search subtree or measure allocation costs. Observer elapsed times are provenance only.

No fresh native DRC, full 26×3, dense, ladder or slow acceptance run is claimed. Historical native thermal findings remain unresolved. This diagnostic produces no scored benchmark/history row and makes no speed or quality gain claim. Any optimization requires separate output parity, alternating timing and full native/stress validation before adoption.

From the repository root, with an unused work path:

```bash
asset=docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-census
work=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle75
python3 "$asset/prepare.py" "$work/work"
taskset -c 12-19 nice -n 10 timeout 30 bun "$asset/controls.ts" "$work/work/source"
for r in 1 2 3; do
  taskset -c 12-19 nice -n 10 timeout 300 bun "$asset/run.ts" "$work/work/source" "$work/work/input" "$work/replay$r"
done
PYTHONDONTWRITEBYTECODE=1 python3 "$asset/report.py" "$work" "$asset"
rsvg-convert -w 1600 "$asset/chart.svg" -o "$asset/chart.png"
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Replay archived checks and generated summary/table/SVG without routing (or run `PYTHONDONTWRITEBYTECODE=1 python3 docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-census/verify.py`):

```bash
PYTHONDONTWRITEBYTECODE=1 python3 - <<'PY'
from pathlib import Path
import gzip,hashlib,importlib.util,json,tempfile
p=Path('docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-census')
for name,digest in json.loads((p/'manifest.json').read_text()).items():
    assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest
spec=importlib.util.spec_from_file_location('report',p/'report.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.source_check(json.loads((p/'source-audit.json').read_text()),gzip.decompress((p/'quilt-observer.ts.gz').read_bytes()))
records=json.loads(gzip.decompress((p/'records.json.gz').read_bytes()))
with tempfile.TemporaryDirectory() as d:
    m.emit(records,Path(d))
    for name in ('summary.json','table.md','chart.svg'):
        assert (Path(d)/name).read_bytes()==(p/name).read_bytes()
print('archive, source, independent parity and generated artifacts verified')
PY
```

The three observed runs each create 1,101 quilts and make 95,555,929 state lookups: 87,734,583 free hits, 5,764,030 blocked hits, 1,792,585 free misses and 264,731 blocked misses. All invalidation counters are zero. Each state lookup constructs one key in the unchanged implementation; no invalidation keys occur on this workload. The 97.85% cache-hit share motivates investigating hit-path work, but it does not measure the cost of key arithmetic, map lookup, callback dispatch or allocation independently. Replacing invalidation cannot explain an improvement on this input. Other workloads and the public Quilt API still require exact invalidation behavior.

A possible distinct follow-up is a bounded direct-mapped front cache for repeated quilt state queries, retaining the existing map as authoritative and clearing the front cache on every invalidation. This needs an actual slot-locality census before implementation; high hit rate alone does not prove locality or predict gains. Earlier lattice-key and lattice-slot experiments targeted a different module and were parked after mixed or adverse full-suite timing. Do not repeat those unchanged or generalize this board to the suite.

Required production gates pass: typecheck, layer check (71 files, zero violations), and all 912 tests / 399,733 assertions (329.57 seconds). The scratch observer also passes typecheck and layer checks. Logs are archived.
