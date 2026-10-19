"""Validate paired coordinator traces and render charged-work chart."""
import copy,gzip,json,sys
from pathlib import Path

def stable(x):
 if isinstance(x,dict): return {k:stable(v) for k,v in x.items() if k!='seconds'}
 if isinstance(x,list): return [stable(v) for v in x]
 return x

def validate(data):
 assert set(data)=={'before','after'}
 for mode,runs in data.items():
  assert len(runs)==3
  assert all(stable(r)==stable(runs[0]) for r in runs)
  for run in runs:
   assert len(run['rows'])==1
   r=run['rows'][0]; assert r['rewind'] and r['before']==4
   assert r['after']==(4 if mode=='before' else 3)
   assert len(r['attempts'])==4 and r['changed']==(mode=='after')
   for a in r['attempts']:
    result=a['result']; assert a['exact']==0 and result['work']<=100000
    assert result['work']==result['enumeration']+sum(t['result']['expansions'] for t in result['attempts'])
    assert a['remainingAfter']<=a['remainingBefore']
    assert all(t['margin'] in [0,4,8,16] for attempt in result['attempts'] for t in attempt['result']['trials'])
   assert r['copperAfter']['vias']==r['copperBefore']['vias']
   if mode=='before': assert r['copperAfter']==r['copperBefore']
   else:
    assert r['copperAfter']['tracks']==r['copperBefore']['tracks']+1
    assert r['copperAfter']['lengthLu']>r['copperBefore']['lengthLu']
 b=data['before'][0]['rows'][0]; a=data['after'][0]['rows'][0]
 assert b['dsnSha256']==a['dsnSha256'] and b['inputSesSha256']==a['inputSesSha256']
 assert not b['changed']
 assert [t['result']['status'] for t in a['attempts']]==['exhausted','kept','budget','budget']
 kept=a['attempts'][1]; assert kept['remainingAfter']==kept['remainingBefore']-1
 assert kept['result']['attempts'][0]['result']['trials'][-1]['outcome']=='kept'
 return b,a

def main():
 data=json.loads(gzip.decompress(Path(sys.argv[1]).read_bytes())); b,a=validate(data)
 controls=[]
 for mutation in ['missing-repeat','overbudget','false-exact','false-closure']:
  bad=copy.deepcopy(data)
  if mutation=='missing-repeat': bad['after'].pop()
  else:
   for r in bad['after']:
    t=r['rows'][0]['attempts'][1]
    if mutation=='overbudget': t['result']['work']=100001
    elif mutation=='false-exact': t['exact']=1
    else: r['rows'][0]['after']=2
  try: validate(bad)
  except AssertionError: controls.append(mutation)
  else: raise AssertionError('Mutation survived: '+mutation)
 out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
 lines=['| Net | Before status/work | Actual spacing status/work |','|---|---|---|']
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="470" viewBox="0 0 1100 470"><rect width="1100" height="470" fill="white"/><g font-family="sans-serif" fill="#172333"><text x="30" y="36" font-size="24">Bounded coordinator: one combined closure</text><text x="30" y="64" font-size="16">Same saved four residuals; 3 paired repeats; exact violations 0; no native score</text><text x="30" y="92" font-size="16">Gray: global spacing. Blue: actual obstacle spacing. Bars: charged work per target.</text>']
 for i,(x,y) in enumerate(zip(b['attempts'],a['attempts'])):
  bx=x['result'];ay=y['result'];net=x['target']['net'];lines.append(f"| {net} | {bx['status']} / {bx['work']} | {ay['status']} / {ay['work']} |")
  top=125+i*72
  svg.append(f'<text x="30" y="{top+18}" font-size="17">Net {net}</text>')
  for k,(r,color) in enumerate([(bx,'#87929e'),(ay,'#167bab')]):
   w=r['work']/200; yy=top+k*25
   svg.append(f'<rect x="130" y="{yy}" width="{w}" height="19" fill="{color}"/><text x="{140+w}" y="{yy+15}" font-size="15">{r["status"]}: {r["work"]}</text>')
 svg.append('<text x="30" y="445" font-size="16">Engine residuals 4 → 3. Remaining targets 10/11 reach shared 100000-work limits.</text></g></svg>')
 (out/'work.svg').write_text(''.join(svg)+'\n');(out/'cases.md').write_text('\n'.join(lines)+'\n')
 (out/'summary.json').write_text(json.dumps({'repeats':3,'before':b,'after':a,'mutationControls':controls},indent=2)+'\n')
 print('PASS: repeated traces, ledger sums, exact gates, rollback, paired inputs; 4 mutation controls')
if __name__=='__main__':main()
