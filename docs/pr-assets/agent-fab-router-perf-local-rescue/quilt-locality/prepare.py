"""Prepare a diagnostic-only source copy; never change query decisions or order."""
from pathlib import Path
import gzip, hashlib, io, json, subprocess, sys, tarfile
ROOT = Path(__file__).resolve().parents[4]
out = Path(sys.argv[1]).resolve()
assert not out.exists(), 'unused output required'
out.mkdir(parents=True)
source = out / 'source'; source.mkdir()
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','HEAD'], cwd=ROOT))) as archive:
    archive.extractall(source, filter='data')
(source/'node_modules').symlink_to(ROOT/'node_modules', target_is_directory=True)
p = source/'src/route/quilt.ts'
original = p.read_text()
s = original
replacements = [('  const cache = new Map<number, PatchState>();', '  const cache = new Map<number, PatchState>();\n  const meter = ((globalThis as any).__quiltCensus ??= {quilts:0,calls:0,mapHits:0,invalidations:0,slots:[64,256,1024].map(size=>({size,hits:0,cold:0,collisions:0}))});\n  meter.quilts++;\n  const fronts = meter.slots.map((counter:any)=>({counter,keys:new Float64Array(counter.size),valid:new Uint8Array(counter.size)}));\n  function observe(gx:number, gy:number, key:number, cached:PatchState|undefined):void {\n    meter.calls++; if(cached!==undefined)meter.mapHits++;\n    for(const f of fronts){\n      const slot=((gx & (f.counter.size-1)) ^ Math.imul(gy,31)) & (f.counter.size-1);\n      if(f.valid[slot] && f.keys[slot]===key){\n        if(cached===undefined)throw Error("stale simulated front entry");\n        f.counter.hits++;\n      } else {\n        f.counter[f.valid[slot] ? "collisions" : "cold"]++;\n        f.valid[slot]=1;f.keys[slot]=key;\n      }\n    }\n  }'), ('    const cached = cache.get(key);', '    const cached = cache.get(key);\n    observe(gx, gy, key, cached);'), ('    if (cache.size === 0) return;', '    meter.invalidations++; for(const f of fronts)f.valid.fill(0);\n    if (cache.size === 0) return;')]
for old,new in replacements:
    assert s.count(old)==1, old
    s=s.replace(old,new)
p.write_text(s)
audit={}
for raw in subprocess.check_output(['git','ls-files','-z','src','spec','test'],cwd=ROOT).split(b'\0'):
    if not raw: continue
    rel=Path(raw.decode());before=ROOT/rel;after=source/rel
    audit[str(rel)]={'original':hashlib.sha256(before.read_bytes()).hexdigest(),'observer':hashlib.sha256(after.read_bytes()).hexdigest()}
assert [k for k,v in audit.items() if v['original']!=v['observer']]==['src/route/quilt.ts']
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'quilt-observer.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input';inputs.mkdir()
assets=ROOT/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'
for name,archive in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((assets/archive).read_bytes()))
