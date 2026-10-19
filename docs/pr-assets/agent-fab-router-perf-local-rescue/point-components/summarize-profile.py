"""Summarize sampled self and inclusive stack time without attributing speedup."""
from pathlib import Path
from collections import defaultdict,Counter
import json,sys
profile,replay,out=map(Path,sys.argv[1:]);d=json.loads(profile.read_text());r=json.loads(replay.read_text())
nodes={n['id']:n for n in d['nodes']};parents={c:n['id']for n in d['nodes']for c in n.get('children',[])}
def key(n):
 f=n['callFrame'];url=f.get('url','');return (f.get('functionName',''),url.split('/fr-perf/')[-1],f.get('lineNumber',-1)+1)
self_us=Counter();inclusive_us=Counter();samples=Counter()
for node,delta in zip(d['samples'],d['timeDeltas']):
 k=key(nodes[node]);self_us[k]+=delta;samples[k]+=1
 seen=set()
 while node in nodes:
  k=key(nodes[node]);seen.add(k);node=parents.get(node)
 for k in seen:inclusive_us[k]+=delta
rows=[{'function':k[0],'file':k[1],'line':k[2],'self_samples':samples[k],'self_sample_ms':value/1000,'inclusive_sample_ms':inclusive_us[k]/1000}for k,value in self_us.most_common()]
recovery=[{'function':k[0],'file':k[1],'inclusive_sample_ms':v/1000}for k,v in inclusive_us.items()if k[0]in ['recoverRemaining','recoverPointComponent','scheduleRecovery','proposeVisibility']]
result={'scope':'Single complete production replay; sampled elapsed stack time, not a paired timing comparison','wall_seconds':r['seconds'],'total_samples':len(d['samples']),'sampled_ms':sum(d['timeDeltas'])/1000,'top_self':rows[:30],'recovery_stacks':recovery,'ses_sha256':r['sesSha256'],'engine_opens':r['report']['incompleteAfter'],'exact_violations':r['stats']['violations']['total']}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'wall_s':r['seconds'],'top_self':rows[:5],'recovery':recovery}))
