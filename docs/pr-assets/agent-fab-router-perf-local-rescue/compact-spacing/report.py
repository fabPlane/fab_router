import gzip,json,sys,copy
from pathlib import Path
asset=Path(__file__).parent
def validate(d):
 assert set(d)=={'before','after'}
 for mode,runs in d.items():
  assert len(runs)==3 and runs[0]==runs[1]==runs[2]
  for rows in runs:
   assert len(rows)==18
   assert [(r['source'],r['obstacle'],r['budget']) for r in rows]==[(s,o,b) for s in ['kind','sheet','rule'] for o in ['pad','track','barrel'] for b in [10,1000]]
   for r in rows:
    kept=mode=='after' and r['source']!='rule' and r['budget']==1000
    assert r['status']==('budget' if r['budget']==10 else 'kept' if kept else 'exhausted')
    assert r['remaining']==int(not kept) and r['exact']==0
    assert 0<r['expansions']<=r['budget']
    if r['budget']==10:assert r['expansions']==10
    assert bool(r['path'])==kept
 return d
d=validate(json.loads(gzip.decompress((asset/'results.json.gz').read_bytes())))
for mutation in ['repeat','rule','exact','budget']:
 bad=copy.deepcopy(d)
 if mutation=='repeat':bad['after'].pop()
 if mutation=='rule':
  for rows in bad['after']:rows[-1]['status']='kept'
 if mutation=='exact':
  for rows in bad['after']:rows[1]['exact']=1
 if mutation=='budget':
  for rows in bad['after']:rows[0]['expansions']=11
 try:validate(bad)
 except AssertionError:pass
 else:raise AssertionError(mutation)
path=next(r['path'] for r in d['after'][0] if r['path'])
points=' '.join(f'{100+p["x"]*.08},{220-p["y"]*.08}' for p in path)
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="390" viewBox="0 0 1000 390">
<rect width="1000" height="390" fill="white"/>
<g font-family="sans-serif" fill="#172b4d"><text x="35" y="40" font-size="24">Compact local-spacing regression: actual retained path</text>
<text x="35" y="75" font-size="17">Same geometry / rules / width / region; only corner proposal offsets differ.</text>
<rect x="4" y="124" width="992" height="192" fill="#edf4ff" stroke="#86a7c8"/>
<path d="M100 220 L900 220" stroke="#b34b4b" stroke-width="2" stroke-dasharray="8 8"/>
<polyline points="{points}" fill="none" stroke="#167a4c" stroke-width="16" stroke-linejoin="round"/>
<circle cx="500" cy="220" r="40" fill="#af6d23"/>
<circle cx="100" cy="220" r="40" fill="#3875a3"/><circle cx="900" cy="220" r="40" fill="#3875a3"/>
<text x="35" y="350" font-size="17">Global: 0/6 closures. Actual kind/sheet: 6/6. Three identical paired repeats.</text>
<text x="35" y="378" font-size="16">Engine exact DRC: zero. Native DRC / full-suite gains unmeasured. Default remains off.</text></g></svg>'''
(asset/'path.svg').write_text(svg)
print('Archive parity + four rejected mutation controls PASS')
