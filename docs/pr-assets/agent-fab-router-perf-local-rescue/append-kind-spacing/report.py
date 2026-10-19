"""Replay the rejection, work ledger and observed prefix invariance."""
import copy,gzip,hashlib,json,statistics,sys
from pathlib import Path

def stable(x):
 if isinstance(x,dict):return {k:stable(v) for k,v in x.items() if k!='seconds'}
 if isinstance(x,list):return [stable(v) for v in x]
 return x

def validate(d,p):
 assert set(d)=={'before','after'} and p['unchanged'] and len(p['rows'])==16
 assert len({(r['target']['net'],r['margin'],r['sheet']) for r in p['rows']})==16
 for r in p['rows']:
  b,a=r['nodes']['before'],r['nodes']['after']
  assert b==a[:len(b)] and len(b)<len(a)<=512
  assert r['margin'] in [0,4,8,16] and r['generationWork']['after']>r['generationWork']['before']
 for mode,runs in d.items():
  assert len(runs)==3 and all(stable(r)==stable(runs[0]) for r in runs)
  for run in runs:
   assert len(run['rows'])==1
   r=run['rows'][0]
   assert r['before']==r['after']==4 and r['rewind'] and not r['changed']
   assert r['copperBefore']==r['copperAfter'] and len(r['attempts'])==4
   assert r['dsnSha256']==p['dsnSha256'] and r['inputSesSha256']==p['sesSha256']
   assert [a['target']['net'] for a in r['attempts']]==[4,9,10,11]
   works=[17747,83159,90626,88414] if mode=='before' else [57440,100000,100000,100000]
   statuses=['exhausted']*4 if mode=='before' else ['exhausted','budget','budget','budget']
   for a,w,status in zip(r['attempts'],works,statuses):
    result=a['result'];assert a['exact']==0 and a['remainingBefore']==a['remainingAfter']==4
    assert result['work']==w and result['status']==status and 0<=result['work']<=100000
    assert result['work']==result['enumeration']+sum(t['result']['expansions'] for t in result['attempts'])
    assert all(t['nodes']<=512 and not t['found'] for x in result['attempts'] for t in x['proposals'])
    assert all(t['margin'] in [0,4,8,16] for x in result['attempts'] for t in x['result']['trials'])
 assert d['before'][0]['rows'][0]['finalSesSha256']==d['after'][0]['rows'][0]['finalSesSha256']
 return d['before'][0]['rows'][0],d['after'][0]['rows'][0]

def main():
 raw,prefix,out=map(Path,sys.argv[1:]);d=json.loads(gzip.decompress(raw.read_bytes()));p=json.loads(gzip.decompress(prefix.read_bytes()))
 b,a=validate(d,p);controls=[]
 for mutation in ['missing-repeat','false-closure','false-exact','overbudget','broken-prefix','false-ledger']:
  bad=copy.deepcopy(d);bp=copy.deepcopy(p)
  if mutation=='missing-repeat':bad['after'].pop()
  elif mutation=='broken-prefix':bp['rows'][0]['nodes']['after'][0]['x']+=1
  else:
   for run in bad['after']:
    r=run['rows'][0]
    if mutation=='false-closure':r['after']=3
    elif mutation=='false-exact':r['attempts'][0]['exact']=1
    elif mutation=='overbudget':r['attempts'][1]['result']['work']=100001
    else:r['attempts'][0]['result']['enumeration']+=1
  try:validate(bad,bp)
  except AssertionError:controls.append(mutation)
  else:raise AssertionError(mutation)
 out.mkdir(parents=True,exist_ok=True)
 totals={m:[sum(a['result']['seconds'] for a in r['rows'][0]['attempts']) for r in runs] for m,runs in d.items()}
 summary={'decision':'Reject eager append-only enrichment under existing target budget','repeats':3,'prefixGraphs':16,'enrichedGraphs':16,'work':{m:sum(x['result']['work'] for x in r['attempts']) for m,r in [('before',b),('after',a)]},'seconds':{m:{'median':statistics.median(v),'max':max(v)} for m,v in totals.items()},'mutationControls':controls}
 (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
 lines=['| Net | Original status / work | Append-only status / work |','|---|---|---|']
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="470" viewBox="0 0 1100 470"><rect width="1100" height="470" fill="white"/><g font-family="sans-serif" fill="#172333"><text x="30" y="36" font-size="24">REJECTED: eager append-only waypoint enrichment</text><text x="30" y="64" font-size="16">3 paired repeats, same saved four residuals: 4 remain in both modes; no native score</text><text x="30" y="92" font-size="16">Gray: original. Orange: appended corners. Bars: charged work per original target.</text>']
 for i,(x,y) in enumerate(zip(b['attempts'],a['attempts'])):
  net=x['target']['net'];lines.append(f"| {net} | {x['result']['status']} / {x['result']['work']} | {y['result']['status']} / {y['result']['work']} |")
  top=125+i*72;svg.append(f'<text x="30" y="{top+18}" font-size="17">Net {net}</text>')
  for k,(r,color) in enumerate([(x['result'],'#87929e'),(y['result'],'#c76a19')]):
   w=r['work']/200;yy=top+k*25
   svg.append(f'<rect x="130" y="{yy}" width="{w}" height="19" fill="{color}"/><text x="{140+w}" y="{yy+15}" font-size="15">{r["status"]}: {r["work"]}</text>')
 svg.append('<text x="30" y="445" font-size="16">All 16 observed graphs retain the entire original node prefix; more nodes still consume work.</text></g></svg>')
 (out/'work.svg').write_text(''.join(svg)+'\n');(out/'cases.md').write_text('\n'.join(lines)+'\n')
 print('PASS: six repeated coordinator runs, 16 prefixes, ledger/rollback; six mutations rejected')
if __name__=='__main__':main()
