"""Prepare an isolated callback-inlining experiment from the recorded source revision."""
from pathlib import Path
import gzip, hashlib, io, json, subprocess, sys, tarfile
ROOT=Path(__file__).resolve().parents[4]
out=Path(sys.argv[1]).resolve(); assert not out.exists(); out.mkdir(parents=True)
revision='66d50ed'
for mode in ('original','candidate'):
    source=out/mode; source.mkdir()
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',revision],cwd=ROOT))) as archive:
        archive.extractall(source,filter='data')
    (source/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
p=out/'candidate/src/lattice/grid.ts'; s=p.read_text()
start=s.index('    const test = (s: number): boolean => {',s.index('  function collect('))
end=s.index('    const cx0 = Math.max',start)
s=s[:start]+s[end:]
body='''if (q.x0 > sX1[s]! || sX0[s]! > q.x1 || q.y0 > sY1[s]! || sY0[s]! > q.y1) continue;
            if (sweep && (q.s0 > sS1[s]! || sS0[s]! > q.s1 || q.d0 > sD1[s]! || sD0[s]! > q.d1)) continue;
            const leg = sLeg[s]!;
            const ref: LatticeItemRef = leg === NO_LEG ? { id: sId[s]! } : { id: sId[s]!, leg };
            if (filter && !filter(ref)) continue;
            out.push(ref);'''
assert s.count('if (test(s)) push(s);')==2
s=s.replace('if (test(s)) push(s);',body,1)
s=s.replace('    for (const s of g.shelf) if (test(s)) push(s);','    for (const s of g.shelf) {\n      '+body.replace('\n            ','\n      ')+'\n    }')
p.write_text(s)
audit={}
for raw in subprocess.check_output(['git','ls-tree','-r','--name-only','-z',revision,'src','spec','test'],cwd=ROOT).split(b'\0'):
    if not raw: continue
    name=raw.decode(); audit[name]={mode:hashlib.sha256((out/mode/name).read_bytes()).hexdigest() for mode in ('original','candidate')}
assert [k for k,v in audit.items() if v['original']!=v['candidate']]==['src/lattice/grid.ts']
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'grid-candidate.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input'; inputs.mkdir()
for name,archive in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((ROOT/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'/archive).read_bytes()))

for mode in ['original','candidate']:
 p=out/mode;entry=p/'entry/src';entry.mkdir(parents=True)
 (entry/'api.ts').write_text("import {routeDsn as run} from '../../src/api.ts';\nexport function routeDsn(text:any,settings:any,hooks:any){return run(text,{...settings,localRecovery:true},hooks);}\n")
 subprocess.run(['git','init','-q','-b','agent/fab-router-perf-inline-native',str(p)],check=True)
 subprocess.run(['git','-C',str(p),'add','src','spec','test','tools','package.json','tsconfig.json','entry'],check=True)
 subprocess.run(['git','-C',str(p),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-qm','Capture lattice callback comparison'],check=True)
