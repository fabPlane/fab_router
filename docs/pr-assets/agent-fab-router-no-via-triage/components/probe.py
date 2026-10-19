"""Separate finite hard-grid reachability from A* pop-budget exhaustion. No production edits."""
import argparse, hashlib, io, json, os, subprocess, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
ASSETS=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--repeats',type=int,default=3)
a=p.parse_args(); assert a.repeats>0
out=a.out.resolve(); out.mkdir(parents=True,exist_ok=False)
results=[]; sources={}
for factor in (1,8):
    tree=out/f'factor-{factor}';tree.mkdir()
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','69cf598'],cwd=ROOT))) as t:t.extractall(tree,filter='data')
    (tree/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
    source=tree/'src/route/passes.ts';s=source.read_text()
    old='maxPops: Math.min(MAX_POPS, Math.max(4000, cells)),'
    assert s.count(old)==1
    s=s.replace(old,f'maxPops: Math.min(MAX_POPS, Math.max(4000, cells)) * ((process.env.ROUTER_COMPONENT_ACTIVE || process.env.ROUTER_BUDGET_ACCEPTANCE) ? {factor} : 1),')
    needle='    if (!res.ok) {\n      if (deadline !== undefined && now() > deadline) return false;'
    assert s.count(needle)==2
    s=s.replace(needle,'''    if (process.env.ROUTER_COMPONENT_ACTIVE) console.error('SEARCH', JSON.stringify({net,sheet,div,step:region.step,cells,ok:res.ok,pops:res.pops,aborted:res.aborted}));
'''+needle,1)
    source.write_text(s)
    source=tree/'src/route/search.ts';s=source.read_text()
    needle='  const width = region.gx1 - region.gx0 + 1;'
    assert s.count(needle)==2
    bfs='''  if (process.env.ROUTER_COMPONENT_ACTIVE) {
    // Hard search only: no soft edge costs or corridor restriction in this probe.
    if (o.corridorBias) throw Error('unexpected corridor');
    const key = (x:number,y:number) => `${x},${y}`;
    const seen = new Set<string>([key(start.gx,start.gy)]);
    const queue = [start]; let reached = false;
    for (let head=0; head<queue.length; head++) {
      const cell=queue[head]!;
      if (cell.gx===goal.gx && cell.gy===goal.gy) reached=true;
      for (const [dx,dy] of dirs) {
        const gx=cell.gx+dx,gy=cell.gy+dy,k=key(gx,gy);
        if (gx<region.gx0 || gx>region.gx1 || gy<region.gy0 || gy>region.gy1 || seen.has(k)) continue;
        const isGoal=gx===goal.gx && gy===goal.gy;
        if (!isGoal && !space.nodeFree(gx,gy)) continue;
        if (space.edgeCost(space.pointOf(cell.gx,cell.gy),space.pointOf(gx,gy)).blocked) continue;
        seen.add(k);queue.push({gx,gy});
      }
    }
    console.error('COMPONENT',JSON.stringify({step:space.step,region,start,goal,reachableCells:seen.size,reached}));
  }
'''
    source.write_text(s.replace(needle,bfs+needle,1))
    (tree/'components.ts').write_bytes((ASSETS/'components.ts').read_bytes())
    controls=['spec/acceptance/boards/Issue026-J2_reference.dsn','spec/acceptance/cases/routing-slow-issue026-j2-novia.json','tools/acceptance/run.ts','tools/acceptance/run-case.ts']
    paths=[x for folder in ('src','spec/types') for x in sorted((tree/folder).rglob('*')) if x.is_file()]+[tree/x for x in controls]
    hashes={str(x.relative_to(tree)):hashlib.sha256(x.read_bytes()).hexdigest() for x in paths}
    for name in controls:
        assert hashlib.sha256(subprocess.check_output(['git','show',f'69cf598:{name}'],cwd=ROOT)).hexdigest()==hashes[name]
    sources[str(factor)]=hashes
    for repeat in range(a.repeats):
        r=subprocess.run(['bun','components.ts'],cwd=tree,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
        (out/f'factor-{factor}-{repeat}.log').write_bytes(r.stderr)
        assert r.returncode==0,r.stderr.decode()[-2000:]
        report=json.loads(r.stdout); events=[]
        for line in r.stderr.decode().splitlines():
            for label in ('PAIR','COMPONENT','SEARCH'):
                if line.startswith(label+' '):events.append({'type':label,**json.loads(line[len(label)+1:])})
        assert all(e['reached'] for e in events if e['type']=='COMPONENT')
        assert all(x['ok']==(factor==8) for x in report['attempts'])
        assert sum(e['type']=='PAIR' for e in events)==5
        assert sum(e['type']=='COMPONENT' for e in events)==sum(e['type']=='SEARCH' for e in events)
        results.append(dict(factor=factor,repeat=repeat,report=report,events=events))
    for repeat in range(a.repeats):
        report_path=out/f'acceptance-{factor}-{repeat}.json'
        run=subprocess.run(['bun','run','tools/acceptance/run.ts','--tier','slow','--case','routing-slow-issue026-j2-novia','--report',str(report_path)],cwd=tree,env={**os.environ,'ROUTER_BUDGET_ACCEPTANCE':'1'},stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=180)
        (out/f'acceptance-{factor}-{repeat}.log').write_bytes(run.stdout)
        assert run.returncode in (0,1)
        measured=json.loads(report_path.read_text())
        assert len(measured['cases'])==1 and not measured['invalidCases']
        case=measured['cases'][0]; m=case['measured']
        assert case['expected']['incomplete']=={'max':6}
        assert m['incomplete']==(12 if factor==1 else 9) and run.returncode==1
        assert m['violationsAdded']==0 and m['addedBarrels']==0 and not m['timedOut'] and not m['aborted']
        results.append(dict(scope='acceptance',factor=factor,repeat=repeat,exit_code=run.returncode,report=measured,log=run.stdout.decode()))
    assert all(hashlib.sha256((tree/name).read_bytes()).hexdigest()==value for name,value in hashes.items())
    for name in ('src/route/search.ts' ,'src/route/passes.ts'):
        (out/f'factor-{factor}-{Path(name).name}').write_bytes((tree/name).read_bytes())
(out/'results.json').write_text(json.dumps({'scope':'Fresh-input hard-grid diagnostics and unchanged engine acceptance; no native DRC coverage', 'source_sha256':sources,'results':results},indent=2)+'\n')
for r in results:
    if r.get('scope')=='acceptance':
        print('acceptance',r['factor'],r['repeat'],r['exit_code'],r['report']['cases'][0]['measured']);continue
    print(r['factor'],r['repeat'],[(x['pair']['net'],x['ok']) for x in r['report']['attempts']])
