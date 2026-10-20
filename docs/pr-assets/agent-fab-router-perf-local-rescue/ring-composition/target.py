from pathlib import Path
import subprocess,json
w=Path(__file__).resolve().parent;rows=[]
for pair in range(3):
 for mode in (['original','candidate']if pair%2==0 else['candidate','original']):
  name=f'target-{pair}-{mode}'
  with (w/(name+'.log')).open('w')as log:
   r=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','420','bun',w/'target.ts',w/mode,w/(name+'.json')],stdout=log,stderr=subprocess.STDOUT)
  assert r.returncode==0,(name,r.returncode)
  row=json.loads((w/(name+'.json')).read_text());row.update(pair=pair,mode=mode);rows.append(row)
  (w/'target-records.json').write_text(json.dumps(rows,indent=2)+'\n');print(name,row['result']['measured']['incomplete'],row['result']['pass'],flush=True)
adverse=[]
for pair in range(3):
 a,b=[next(r for r in rows if r['pair']==pair and r['mode']==m)for m in ['original','candidate']]
 assert a['settings']==b['settings']and a['result']['expected']==b['result']['expected']
 x,y=a['result']['measured'],b['result']['measured']
 if (a['result']['pass']and not b['result']['pass'])or y.get('incomplete',0)>x.get('incomplete',0)or y.get('violationsAdded',0)>x.get('violationsAdded',0)or any(k.startswith('invariant:')and v is False for k,v in y.items()):adverse.append(pair)
(w/'target-summary.json').write_text(json.dumps({'scope':'Fresh3alternating paired strict300s acceptance runs; historical adverse retained; no causal timing claim','adverse_pairs':adverse,'counts':{m:[r['result']['measured']['incomplete']for r in rows if r['mode']==m]for m in ['original','candidate']}},indent=2)+'\n')
print('adverse pairs',adverse,flush=True)
