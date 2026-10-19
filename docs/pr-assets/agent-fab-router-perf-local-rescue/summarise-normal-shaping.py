"""Audit controls and retain per-attempt shaping counts, including failed proposals."""
import collections,json,pathlib,statistics,sys
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
if out.exists():raise SystemExit('output exists')
rows=[]
for context in ['reduced','original']:
 control=json.loads((root/f'{context}-control.json').read_text())
 for mode in ['control','observed','raw']:
  result=json.loads((root/f'{context}-{mode}.json').read_text());counts=[];c=None
  for line in (root/f'{context}-{mode}.txt').read_text().splitlines():
   if line.startswith('NORMAL_BEGIN '): c=collections.Counter();counts.append(c)
   if line.startswith('NORMAL_SHAPE '):
    r=json.loads(line.removeprefix('NORMAL_SHAPE '));c['rejectedPulled']+=1;c['rawLegal']+=r['rawLegal'];c['perLegLegal']+=r['perLegLegal']
  assert len(counts)==len(result['rows'])==3
  for i,r in enumerate(result['rows']):
   assert not r['violations'] and not r['aborted'] and not r['timedOut']
   assert all(c['from']==10 and c['to']==62 for c in r['left'])
   if mode!='raw' or context=='original':assert r['session']==control['rows'][i]['session']
   rows.append({'context':context,'mode':mode,**r,'observations':dict(counts[i])})
summary={'scope':'Engine-only altered contexts, 3 repeats, cores 12–19; no native safety or speed gain claim','attempts':rows}
out.write_text(json.dumps(summary,indent=2)+'\n')
for context in ['reduced','original']:
 for mode in ['control','observed','raw']:
  rr=[r for r in rows if r['context']==context and r['mode']==mode]
  print(context,mode,'opens',sum(len(r['left']) for r in rr),'median',statistics.median(r['seconds'] for r in rr),'p95',max(r['seconds'] for r in rr), 'counts',[r['observations'] for r in rr])
