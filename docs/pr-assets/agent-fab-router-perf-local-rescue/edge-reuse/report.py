"""Validate observer parity and count repeated directed exact shaping calls."""
import collections,gzip,json,sys
from pathlib import Path
here=Path(__file__).resolve().parent

def clean(x):
 if isinstance(x,dict):return {k:clean(v) for k,v in x.items() if k not in ['seconds','trace']}
 if isinstance(x,list):return [clean(v) for v in x]
 return x

def report(data,reference):
 assert len(data)==len(reference)==3
 rows=[]
 for repeat,(run,ref) in enumerate(zip(data,reference)):
  assert clean(run)==clean(ref),'Observer changed original coordinator trace'
  assert clean(run)==clean(data[0]),'Repeat drift'
  assert len(run['rows'])==1
  r=run['rows'][0]
  assert r['before']==r['after']==4 and r['rewind'] and not r['changed']
  assert r['copperBefore']==r['copperAfter']
  assert len(r['attempts'])==4
  counts=[]
  for a in r['attempts']:
   assert a['exact']==0 and a['result']['status']=='exhausted'
   assert len(a['trace'])==sum(p['edges'] for t in a['result']['attempts'] for p in t['proposals']),'Missing edge records'
   seen=collections.defaultdict(set)
   for edge in a['trace']:
    key=json.loads(edge['key']);result=json.loads(edge['result'])
    assert len(key)==3 and isinstance(result['ok'],bool)
    seen[edge['key']].add(edge['result'])
   assert all(len(v)==1 for v in seen.values()),'Same directed edge changed shaping'
   assert len(a['trace'])>=len(seen)>0
   counts.append({'net':a['target']['net'],'calls':len(a['trace']),'unique':len(seen),'repeated':len(a['trace'])-len(seen),'work':a['result']['work']})
  if repeat:assert counts==rows
  rows=counts
 return {'repeats':3,'targets':rows,'calls':sum(r['calls'] for r in rows),'unique':sum(r['unique'] for r in rows),'repeated':sum(r['repeated'] for r in rows),'nativeMeasured':False}

if __name__=='__main__':
 data=json.loads(gzip.decompress(Path(sys.argv[1]).read_bytes()))
 reference=json.loads(gzip.decompress((here/'../deferred-kind-spacing/results.json.gz').read_bytes()))['before']
 s=report(data,reference);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
 (out/'summary.json').write_text(json.dumps(s,indent=2)+'\n')
 table='| Net | Exact shaping calls | Distinct directed edges | Repeated calls | Charged work |\n|---|---:|---:|---:|---:|\n'
 for r in s['targets']:table+=f"| {r['net']} | {r['calls']} | {r['unique']} | {r['repeated']} | {r['work']} |\n"
 (out/'table.md').write_text(table)
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="440"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="20" fill="#172735"><text x="40" y="40">Repeated exact edge shaping: saved residual diagnostic</text><text x="40" y="75">Three repeats agree; unchanged search, budget and copper</text>']
 for i,r in enumerate(s['targets']):
  y=110+i*65;u=r['unique']/140;v=r['repeated']/140
  svg+=[f'<text x="40" y="{y+23}">Net {r["net"]}</text><rect x="145" y="{y}" width="{u}" height="30" fill="#247c91"/><rect x="{145+u}" y="{y}" width="{v}" height="30" fill="#db9c39"/><text x="{160+u+v}" y="{y+23}">{r["calls"]}</text>']
 svg+=['<text x="40" y="400">Blue: distinct edges. Gold: repeated calls. No measured speed or native gain.</text></g></svg>']
 (out/'edges.svg').write_text(''.join(svg)+'\n')
 print(json.dumps(s))
