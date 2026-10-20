from pathlib import Path
import subprocess,json,collections
w=Path(__file__).resolve().parent
summary={}
for mode in ['original','candidate']:
 with (w/f'profile-{mode}.jsonl').open('w') as out,(w/f'profile-{mode}.stderr').open('w') as err:
  r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','600','bun','--cpu-prof','--cpu-prof-dir',str(w),'--cpu-prof-name',f'{mode}.cpuprofile',str(w/'replay.ts'),str(w/mode),(w/'work-path.txt').read_text().strip(),'1'],stdout=out,stderr=err)
 assert r.returncode==0
 result=json.loads((w/f'profile-{mode}.jsonl').read_text());reference=json.loads((w/'probe-0-original.jsonl').read_text().splitlines()[0]);assert result['ses_sha256']==reference['ses_sha256']and result['statsAfter']==reference['statsAfter']
 data=json.loads((w/f'{mode}.cpuprofile').read_text());nodes={n['id']:n for n in data['nodes']};counts=collections.Counter()
 for n,delta in zip(data['samples'],data['timeDeltas']):
  f=nodes[n]['callFrame'];counts[(f['functionName'],f['url'],f['lineNumber']+1)]+=delta
 summary[mode]=[dict(function=k[0],file=k[1],line=k[2],sample_ms=v/1000)for k,v in counts.most_common(30)]
 print('profile',mode,'complete',flush=True)
(w/'profile-summary.json').write_text(json.dumps({'scope':'One separately profiled route per version; all profiled times excluded from timing comparisons; inlining can move function attribution','self_samples':summary},indent=2)+'\n')
