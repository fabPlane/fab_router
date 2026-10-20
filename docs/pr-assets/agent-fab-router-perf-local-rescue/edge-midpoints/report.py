"""Validate and render the bounded waypoint diagnostic using standard Python."""
import gzip, hashlib, json, sys
from pathlib import Path

def validate(data, prior):
    assert len(data)==6
    for mode in ('corners','midpoints'):
        runs=[x for x in data if x['mode']==mode]
        assert len(runs)==3 and runs[0]==runs[1]==runs[2]
        assert runs[0]['readOnlyVerified'] and runs[0]['exactViolations']==0
        assert len(runs[0]['rows'])==4
        for row,old in zip(runs[0]['rows'],prior['rows']):
            assert row['target']==old['target'] and row['sheet']==old['sheet']
            assert row['dsnSha256']==old['dsnSha256'] and row['sesSha256']==old['sesSha256']
            assert row['nodes'][:327]==old['nodes'] and row['cornerCount']==327
            assert len(row['nodes'])==(327 if mode=='corners' else 512)
            raw=json.dumps(row['nodes'],separators=(',',':')).encode()
            assert hashlib.sha256(raw).hexdigest()==row['nodeSha256']
            assert not row['exhausted'] and row['edgeChecks']<=100000
            seen={0};queue=[0];checks=0
            for i in queue:
                assert len(row['adjacency'][i])==len(set(row['adjacency'][i]))
                for j in range(len(row['nodes'])):
                    if i==j or j in seen: continue
                    checks+=1
                    if j in row['adjacency'][i]: seen.add(j);queue.append(j)
            assert sorted(seen)==row['forward'] and checks==row['edgeChecks']
            assert row['reachable']==(1 in seen)
            if mode=='corners': assert row['forward']==old['forward']
            else: assert set(old['forward'])<=seen
    return True

def main():
    source,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
    data=json.loads(gzip.decompress(source.read_bytes()))
    prior=json.loads(gzip.decompress((Path(__file__).parent/'../reachability/results.json.gz').read_bytes()))
    validate(data,prior)
    import copy
    controls={}
    for name in ('missing-run','changed-node','false-path','changed-work'):
        bad=copy.deepcopy(data)
        if name=='missing-run': bad.pop()
        else:
            for run in bad:
                if name=='changed-node': run['rows'][0]['nodes'][0]['x']+=1
                if name=='false-path': run['rows'][0]['reachable']=True
                if name=='changed-work': run['rows'][0]['edgeChecks']+=1
        try: validate(bad,prior)
        except AssertionError: controls[name]='rejected'
        else: raise AssertionError(name)
    modes={m:next(x for x in data if x['mode']==m)['rows'] for m in ('corners','midpoints')}
    lines=['| Net | Nodes before → after | Reachable nodes before → after | Edge checks before → after | Paths (3 repeats) |','|---|---:|---:|---:|---:|']
    summary=[]
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="430"><rect width="1100" height="430" fill="white"/><g font-family="sans-serif" fill="#172b4d"><text x="30" y="40" font-size="24">Obstacle-edge midpoints expand components but find no path</text><text x="30" y="72" font-size="16">Reachable nodes from start: corners (blue), plus midpoints (orange)</text>']
    for k,(a,b) in enumerate(zip(modes['corners'],modes['midpoints'])):
        n=a['target']['net'];before=len(a['forward']);after=len(b['forward'])
        lines.append(f'| {n} | 327 → 512 | {before} → {after} | {a["edgeChecks"]} → {b["edgeChecks"]} | 0/3 → 0/3 |')
        summary.append({'net':n,'before':before,'after':after,'checksBefore':a['edgeChecks'],'checksAfter':b['edgeChecks'],'paths':0})
        y=110+k*75
        svg.extend([f'<text x="30" y="{y+20}" font-size="18">Net {n}</text>',f'<rect x="140" y="{y}" width="{before*8}" height="18" fill="#2463b4"/>',f'<rect x="140" y="{y+23}" width="{after*8}" height="18" fill="#ce761b"/>',f'<text x="800" y="{y+20}" font-size="18">{before} → {after}; no path</text>'])
    svg.append('</g></svg>')
    (out/'cases.md').write_text('\n'.join(lines)+'\n')
    (out/'summary.json').write_text(json.dumps({'rows':summary,'repeatParity':True,'controls':controls},indent=2)+'\n')
    (out/'midpoints.svg').write_text('\n'.join(svg)+'\n')
if __name__=='__main__': main()
