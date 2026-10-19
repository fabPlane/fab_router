"""Validate repeated isolated witnesses and generate a route schematic. Repo root cwd."""
import gzip,json,hashlib,sys
from pathlib import Path
root=Path(__file__).resolve().parent

def validate(runs):
    assert len(runs)==6
    by={m:[r for r in runs if r['mode']==m] for m in ('corners','kind-spacing')}
    prior=json.loads(gzip.decompress((root.parent/'edge-midpoints/results.json.gz').read_bytes()))
    prior=next(r for r in prior if r['mode']=='corners')['rows']
    for mode,repeats in by.items():
        assert len(repeats)==3 and all(r==repeats[0] for r in repeats)
        run=repeats[0]
        assert run['readOnlyVerified'] and run['exactViolations']==0 and not run['skips']
        assert [r['target']['net'] for r in run['rows']]==[4,9,10,11]
        for row,old in zip(run['rows'],prior):
            for key in ('case','target','sheet','region','dsnSha256','sesSha256'):assert row[key]==old[key],key
            nodes=row['nodes'];assert len(nodes)==327 and not row['exhausted']
            assert row['nodeSha256']==hashlib.sha256(json.dumps(nodes,separators=(',',':')).encode()).hexdigest()
            if mode=='corners':
                assert row['nodes']==old['nodes'] and row['forward']==old['forward']
            assert all(s['actual']==2000 and s['maxSpacing']==5000 and s['exactMargin']==3251 and s['globalMargin']==6251 for s in row['spacingSamples'])
            seen={0};queue=[0];checks=0
            for i in queue:
                edges=iter(row['adjacency'][i]);edge=next(edges,None)
                for j in range(len(nodes)):
                    if j==i or j in seen:continue
                    checks+=1
                    if j==edge:seen.add(j);queue.append(j);edge=next(edges,None)
                assert edge is None
            assert sorted(seen)==row['forward'] and checks==row['edgeChecks']<=100000
            assert row['reachable']==(1 in seen)
            p=row['proposal']
            if p:
                assert row['reachable'] and p['status']=='kept' and p['exactViolations']==0
                assert p['remainingBefore']==4 and p['remainingAfter']==3
                assert p['width']==2500 and p['kind']==1
                assert p['pts'][0]==nodes[0] and p['pts'][-1]==nodes[1]
                h=p['width']/2;r=row['region']
                assert all(r['x0']<=v['x']-h and v['x']+h<=r['x1'] and r['y0']<=v['y']-h and v['y']+h<=r['y1'] for v in p['pts'])
            else:assert not row['reachable']
    assert sum(r['reachable'] for r in by['kind-spacing'][0]['rows'])==3
    return by

if __name__=='__main__':
    runs=json.loads(gzip.decompress(Path(sys.argv[1]).read_bytes()));by=validate(runs)
    # Archive integrity controls, not independent geometric proof.
    for mutation in ('missing-run','changed-node','false-path','changed-work'):
        copy=json.loads(json.dumps(runs))
        if mutation=='missing-run':copy.pop()
        else:
            mode=copy[0]['mode']
            for run in copy:
                if run['mode']!=mode:continue
                row=run['rows'][0]
                if mutation=='changed-node':row['nodes'][0]['x']+=1
                if mutation=='false-path':row['reachable']=not row['reachable']
                if mutation=='changed-work':row['edgeChecks']+=1
        try:validate(copy)
        except AssertionError:pass
        else:raise AssertionError(mutation)
    out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
    table=['| Net | Reachable nodes before / after | Edge checks before / after | Isolated exact-kept paths (3 repeats) |','|---|---:|---:|---:|']
    for a,b in zip(by['corners'][0]['rows'],by['kind-spacing'][0]['rows']):
        table.append(f"| {a['target']['net']} | {len(a['forward'])} / {len(b['forward'])} | {a['edgeChecks']} / {b['edgeChecks']} | 0/3 / {3 if b['proposal'] else 0}/3 |")
    (out/'cases.md').write_text('\n'.join(table)+'\n')
    row=by['kind-spacing'][0]['rows'][1];pts=row['proposal']['pts'];nodes=row['nodes']
    x0=min(p['x'] for p in nodes);x1=max(p['x'] for p in nodes);y0=min(p['y'] for p in nodes);y1=max(p['y'] for p in nodes)
    scale=min(680/(x1-x0),650/(y1-y0))
    def xy(p,offset):return (offset+30+(p['x']-x0)*scale,100+(p['y']-y0)*scale)
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="white"/>', '<g font-family="sans-serif" fill="#17243a"><text x="40" y="35" font-size="25">Actual kind/sheet spacing connects a previously disconnected candidate graph</text>']
    for offset,mode,title in [(20,'corners','Global maximum offset: no path'),(810,'kind-spacing','Actual obstacle offset: isolated exact-kept path')]:
        r=by[mode][0]['rows'][1]
        svg.append(f'<text x="{offset+20}" y="75" font-size="21">{title}</text>')
        for p in r['nodes']:
            x,y=xy(p,offset);svg.append(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="2" fill="#a9b4c2"/>')
        if r['proposal']:
            line=' '.join(f'{x:.3f},{y:.3f}' for x,y in [xy(p,offset) for p in pts]);svg.append(f'<polyline points="{line}" fill="none" stroke="#14805d" stroke-width="4"/>')
        for n,label in [(0,'from'),(1,'to')]:
            x,y=xy(r['nodes'][n],offset);svg.append(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="7" fill="#cc4c24"/><text x="{x+10:.3f}" y="{y:.3f}" font-size="18">{label}</text>')
    svg.extend(['<text x="40" y="815" font-size="21">Net 9; gray dots: candidate nodes. Schematic only; copper obstacles are omitted.</text>','<text x="40" y="850" font-size="21">Three separate targets pass exact transaction gates. Combined/native closure remains unmeasured.</text>','</g></svg>'])
    (out/'witness.svg').write_text('\n'.join(svg)+'\n')
    (out/'summary.json').write_text(json.dumps({'repeats':3,'targets':4,'independentExactKeptBefore':0,'independentExactKeptAfter':3,'nativeMeasured':False,'productionChanged':False,'mutationsRejected':4},indent=2)+'\n')
    print('\n'.join(table));print('Four archive mutations rejected; runtime geometry replay requires source inputs.')
