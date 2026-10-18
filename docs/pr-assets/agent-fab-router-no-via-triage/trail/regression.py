"""Compare identical tests, geometry and the unchanged no-via acceptance case on this host."""
import argparse, hashlib, io, json, subprocess, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
ASSETS=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--repeats',type=int,default=3)
a=p.parse_args(); assert a.repeats>0
out=a.out.resolve(); out.mkdir(parents=True,exist_ok=False)
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT)
def sha(b): return hashlib.sha256(b).hexdigest()
base='69cf598db98c136bff16bbe02bccdded95674b18'
rows=[]; identities={}; geometries={}
for label in ['before','after']:
    tree=out/label;tree.mkdir()
    with tarfile.open(fileobj=io.BytesIO(git('archive',base))) as t: t.extractall(tree,filter='data')
    (tree/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
    if label=='after':
        subprocess.run(['git','apply',str(ASSETS/'candidate.patch')],cwd=tree,check=True)
    for name in ['test/trail-fallback.test.ts','test/helpers/trail-fallback-board.ts']:
        (tree/name).write_bytes((ASSETS/Path(name).name).read_bytes())
    (tree/'geometry.ts').write_bytes((ASSETS/'geometry.ts').read_bytes())
    controls=['spec/acceptance/boards/Issue026-J2_reference.dsn','spec/acceptance/cases/routing-slow-issue026-j2-novia.json','tools/acceptance/run.ts','tools/acceptance/run-case.ts']
    for name in controls: assert (tree/name).read_bytes()==git('show',f'{base}:{name}')
    identities[label]={str(f.relative_to(tree)):sha(f.read_bytes()) for folder in ['src','spec/types'] for f in sorted((tree/folder).rglob('*')) if f.is_file()}
    for repeat in range(1,a.repeats+1):
        cmd=['bun','test','test/trail-fallback.test.ts']
        r=subprocess.run(cmd,cwd=tree,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=120)
        assert r.returncode==(1 if label=='before' else 0),r.stdout.decode()
        (out/f'{label}-test-{repeat}.log').write_bytes(r.stdout)
        tests=dict(command=cmd,exit_code=r.returncode,log=r.stdout.decode(),sha256=sha(r.stdout))
        report=out/f'{label}-acceptance-{repeat}.json'
        cmd=['bun','run','tools/acceptance/run.ts','--tier','slow','--case','routing-slow-issue026-j2-novia','--report',str(report)]
        r=subprocess.run(cmd,cwd=tree,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=120)
        raw=json.loads(report.read_text());case=raw['cases'][0]
        assert r.returncode==1 and not raw['invalidCases'] and len(raw['cases'])==1
        m=case['measured'];assert m['incomplete']==(12 if label=='before' else 10)
        assert m['violationsAdded']==0 and m['addedBarrels']==0 and not m['timedOut'] and not m['aborted']
        assert case['expected']['incomplete']=={'max':6}
        (out/f'{label}-acceptance-{repeat}.log').write_bytes(r.stdout)
        rows.append(dict(variant=label,repeat=repeat,tests=tests,acceptance=dict(command=cmd,exit_code=r.returncode,log=r.stdout.decode(),report=raw,sha256=sha(report.read_bytes()))))
        r=subprocess.run(['bun','geometry.ts'],cwd=tree,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
        assert r.returncode==0,r.stderr.decode()
        geometry=json.loads(r.stdout)
        geometry['report'].pop('wallClockMs')
        assert geometry['opens']==(1 if label=='before' else 0) and not geometry['violations']
        if label in geometries:assert geometries[label]==geometry
        geometries[label]=geometry
    for name in controls:assert (tree/name).read_bytes()==git('show',f'{base}:{name}')
summary=dict(scope='Engine regression and acceptance only; acceptance still fails max-six gate.',base=base,sources=identities,results=rows,geometry=geometries)
(out/'regressions.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps([dict(variant=r['variant'],repeat=r['repeat'],opens=r['acceptance']['report']['cases'][0]['measured']['incomplete']) for r in rows],indent=2))
