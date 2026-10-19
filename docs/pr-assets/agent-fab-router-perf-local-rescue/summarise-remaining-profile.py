"""Summarise sampled self time below recoverRemaining, excluding the normal route.
Frames are grouped by source URL/function; samples are weighted by timeDeltas.
This is not an allocation count, precise per-function timer or speed comparison.
"""
import collections,hashlib,json,statistics,sys
from pathlib import Path
profile,measurements,out=map(Path,sys.argv[1:]);assert not out.exists()
p=json.loads(profile.read_text());r=json.loads(measurements.read_text());nodes={n['id']:n for n in p['nodes']}
roots=[n['id']for n in p['nodes']if n['callFrame']['functionName']=='recoverRemaining'];assert roots
ids=set();pending=roots[:]
while pending:
 id=pending.pop()
 if id in ids:continue
 ids.add(id);pending.extend(nodes[id].get('children',[]))
assert len(p['samples'])==len(p['timeDeltas'])
weights=collections.Counter();count=0
for id,delta in zip(p['samples'],p['timeDeltas']):
 if id not in ids:continue
 count+=1;f=nodes[id]['callFrame'];weights[(f['url'],f['functionName'])]+=delta
weighted=sum(weights.values());assert weighted>0
rows=[dict(url=k[0],function=k[1],sampled_us=v,percent=v/weighted*100)for k,v in weights.most_common()]
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
result=dict(scope='Sampled self time below all recoverRemaining calls; normal route excluded; twenty same-state replays, not twenty independent full routes; no speed/allocation claim',profile_sha256=sha(profile),measurements_sha256=sha(measurements),total_samples=len(p['samples']),recovery_samples=count,recovery_sampled_us=weighted,replay_median_s=statistics.median(x['seconds']for x in r['rows']),replay_p95_s=sorted(x['seconds']for x in r['rows'])[18],rows=rows)
out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items()if k!='rows'},indent=2));print(json.dumps(rows[:12],indent=2))
