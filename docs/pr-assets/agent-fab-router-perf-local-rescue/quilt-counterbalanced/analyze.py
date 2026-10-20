from pathlib import Path
import json,statistics,math,collections
w=Path(__file__).resolve().parent
rows=[]
for p in sorted(w.glob('[0-3]-*.jsonl')):
 for i,line in enumerate(p.read_text().splitlines()):
  r=json.loads(line);r.update(pair=int(p.name[0]),mode=p.stem.split('-')[1],iteration=i);rows.append(r)
assert len(rows)==16,len(rows)
assert len({r['ses_sha256']for r in rows})==1
assert len({json.dumps(r['statsAfter'],sort_keys=True)for r in rows})==1
assert len({json.dumps(r['settings'],sort_keys=True)for r in rows})==1
assert len({r['input_sha256']for r in rows})==1
assert len({json.dumps({k:v for k,v in r['report'].items() if k!='wallClockMs'},sort_keys=True) for r in rows})==1
assert all(not r['report']['timedOut'] and not r['report']['aborted'] for r in rows)
summary={}
for mode in ['original','candidate']:
 summary[mode]={}
 for iteration in [0,1]:
  times=[r['seconds']for r in rows if r['mode']==mode and r['iteration']==iteration and r['pair']<3]
  summary[mode][str(iteration)]={'n':len(times),'seconds':times,'median':statistics.median(times),'p95_nearest_rank':sorted(times)[math.ceil(.95*len(times))-1]}
profiles={}
for p in w.glob('*.cpuprofile'):
 d=json.loads(p.read_text());nodes={n['id']:n for n in d['nodes']};counts=collections.Counter()
 for n,delta in zip(d['samples'],d['timeDeltas']):
  f=nodes[n]['callFrame'];counts[(f['functionName'],f['url'],f['lineNumber']+1)]+=delta
 profiles[p.stem]=[dict(function=k[0],file=k[1],line=k[2],sample_ms=v/1000)for k,v in counts.most_common(25)]
(w/'summary.json').write_text(json.dumps(dict(timing=summary,identical_sessions=True,statsAfter=rows[0]['statsAfter'],ses_sha256=rows[0]['ses_sha256'],profiles=profiles),indent=2)+'\n')
print(json.dumps(summary,indent=2))
