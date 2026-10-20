"""Validate saved adjacency and reproduce the reachability table/chart (stdlib)."""
import json,sys,gzip,hashlib
from pathlib import Path

def validate(data):
 rows=data['rows'];assert len(rows)==4
 assert len({(r['target']['net'],r['sheet']) for r in rows})==4
 for r in rows:
  n=len(r['nodes']);assert n==327 and r['margin']==64
  assert r['edgeChecks']==n*(n-1)
  assert all(c['excluded']==0 for c in r['counts'].values())
  assert hashlib.sha256(json.dumps(r['nodes'],separators=(',',':')).encode()).hexdigest()==r['nodeSha256']
  adj=r['adjacency'];assert len(adj)==n
  for i,edges in enumerate(adj):assert edges==sorted(set(edges)) and all(0<=j<n and j!=i for j in edges)
  def walk(start,reverse):
   seen={start};todo=[start]
   while todo:
    i=todo.pop()
    for j in (range(n) if reverse else adj[i]):
     if reverse and i not in adj[j]:continue
     if j not in seen:seen.add(j);todo.append(j)
   return sorted(seen)
  f,b=walk(0,False),walk(1,True)
  assert f==r['forward'] and b==r['reverse']
  assert r['reachable']==(1 in f)
  assert r['intersection']==sorted(set(f)&set(b))
 return rows

if __name__=='__main__':
 src,out=map(Path,sys.argv[1:]);data=json.loads(gzip.decompress(src.read_bytes()) if src.suffix=='.gz' else src.read_bytes());rows=validate(data);out.mkdir(parents=True,exist_ok=True)
 text='| Net | Nodes | Directed checks | From start | Can reach end | Intersection | Endpoint reachable |\n|---|---:|---:|---:|---:|---:|---|\n'
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="450"><rect width="1200" height="450" fill="white"/><g font-family="sans-serif" fill="#182635"><text x="30" y="40" font-size="24">Uncapped directed graph: disjoint endpoint reachability</text><text x="30" y="74" font-size="17">327 nodes each; margin 64; saved copper unchanged; no physical impossibility claim</text>']
 for k,r in enumerate(rows):
  f,b=len(r['forward']),len(r['reverse']);net=r['target']['net'];text+=f"| {net} | 327 | {r['edgeChecks']} | {f} | {b} | {len(r['intersection'])} | {r['reachable']} |\n"
  y=110+k*75
  svg.extend([f'<text x="30" y="{y+21}" font-size="18">Net {net}</text>',f'<rect x="140" y="{y}" width="{f*8}" height="24" fill="#2876af"/>',f'<text x="{150+f*8}" y="{y+19}">{f} from start</text>',f'<rect x="140" y="{y+28}" width="{b*8}" height="24" fill="#c16a2b"/>',f'<text x="{150+b*8}" y="{y+47}">{b} can reach end; intersection {len(r["intersection"])}</text>'])
 svg.append('</g></svg>');(out/'cases.md').write_text(text);(out/'reachability.svg').write_text('\n'.join(svg)+'\n')
 (out/'summary.json').write_text(json.dumps({'graphs':len(rows),'directedChecks':sum(r['edgeChecks'] for r in rows),'reachable':sum(r['reachable'] for r in rows),'note':'Read-only graph diagnosis; no routing gain or native run'},indent=2)+'\n')
