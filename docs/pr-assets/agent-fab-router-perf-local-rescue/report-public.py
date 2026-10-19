"""Report all completed public-setting measurements without omitting adverse rows."""
from pathlib import Path
from statistics import median
import json,sys
scratch,out=map(Path,sys.argv[1:]);out.mkdir(exist_ok=True)
r=json.loads((scratch/'native-comparison.json').read_text())
lines=['Three repeats per case, same host and cores 12–19. Per-case p95 is max of three.','', '| Case | Pass off → on | Opens off → on | Errors off → on | Median s off → on | p95 s off → on | Vias median off → on | Length mm median off → on |','|---|---:|---:|---:|---:|---:|---:|---:|']
for i,c in enumerate(r['cases']):
 a,b=c['before'],c['after']
 lines.append(f"| C{i+1:02} | {a['passed']} → {b['passed']} | {a['opens']} → {b['opens']} | {a['new_errors']} → {b['new_errors']} | {a['median_s']:.3f} → {b['median_s']:.3f} | {a['p95_s']:.3f} → {b['p95_s']:.3f} | {a['vias_median']} → {b['vias_median']} | {a['length_mm_median']:.3f} → {b['length_mm_median']:.3f} |")
lines+=['','Case mapping:']+[f"- C{i+1:02}: `{c['case']}`" for i,c in enumerate(r['cases'])]
(out/'native-tables.md').write_text('\n'.join(lines)+'\n')
if (scratch/'large.json').exists():
 data=json.loads((scratch/'large.json').read_text());rows=data['rows'];groups=[]
 for file in dict.fromkeys(x['file']for x in rows):
  g={'file':file}
  for mode in ['normal','candidate']:
   rr=[x for x in rows if x['file']==file and x['mode']==mode]
   g[mode]={'runs':len(rr),'incompletes':[x['report']['incompleteAfter']for x in rr],'errors':[x['report']['violationsAdded']for x in rr],'timeouts':[x['report']['timedOut']for x in rr],'median_s':median(x['seconds']for x in rr) if rr else None,'p95_s':max((x['seconds']for x in rr),default=None),'vias':[x['stats']['barrels']['total']for x in rr],'length_mm':[x['stats']['tracks']['totalLengthMm']for x in rr],'sessions':[x['sesSha256']for x in rr]}
  groups.append(g)
 (out/'large-summary.json').write_text(json.dumps({'complete':len(rows)==18,'groups':groups},indent=2)+'\n')
if (scratch/'slow.json').exists():
 data=json.loads((scratch/'slow.json').read_text());rows=data['rows'];old={x['result']['id']:x['result'] for x in rows if x['mode']=='normal'};new={x['result']['id']:x['result']for x in rows if x['mode']=='candidate'}
 regressions=[];differences=[]
 for id,b in new.items():
  a=old[id]
  changed={k:{'before':a['measured'].get(k),'after':b['measured'].get(k)}for k in set(a['measured'])|set(b['measured'])if k!='wallClockMs'and a['measured'].get(k)!=b['measured'].get(k)}
  if changed:differences.append({'id':id,'changes':changed})
  for key,value in a['measured'].items():
   if (key.startswith('invariant:')and value is True and b['measured'].get(key)is not True)or(key=='aborted'and not value and b['measured'].get(key)):regressions.append({'id':id,'kind':key})
  if a['pass']and not b['pass']:regressions.append({'id':id,'kind':'pass-loss'})
  for key in ['incomplete','incompleteAfter','violationsAdded','violations']:
   if isinstance(a['measured'].get(key),(int,float))and isinstance(b['measured'].get(key),(int,float)) and b['measured'][key]>a['measured'][key]:regressions.append({'id':id,'kind':key,'before':a['measured'][key],'after':b['measured'][key]})
 result={'complete':len(rows)==126 and len(old)==len(new)==63,'expected_cases_per_mode':63,'rows':len(rows),'normal':{'total':len(old),'passed':sum(x['pass']for x in old.values()),'stubbed':sum(x['stub']for x in old.values())},'candidate':{'total':len(new),'passed':sum(x['pass']for x in new.values()),'stubbed':sum(x['stub']for x in new.values())},'regressions':regressions,'differences':differences}
 (out/'slow-summary.json').write_text(json.dumps(result,indent=2)+'\n')
