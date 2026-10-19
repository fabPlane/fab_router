"""Compare three complete paired repeats per larger input; engine checks only."""
from pathlib import Path
from statistics import median
import json,sys
source,out=map(Path,sys.argv[1:]);assert not out.exists()
rows=json.loads(source.read_text())['rows'];assert len(rows)==18
pairs=[];regressions=[]
for file in sorted({r['file']for r in rows}):
 records=[]
 for repeat in [1,2,3]:
  a,b=[next(r for r in rows if r['file']==file and r['repeat']==repeat and r['mode']==mode)for mode in ['before','after']]
  assert a['settings']==b['settings']and a['inputSha256']==b['inputSha256']
  for r in [a,b]:assert not r['report']['timedOut']and not r['report']['aborted']and r['report']['violationsAdded']==0 and r['stats']['violations']['total']==0
  if a['sesSha256']==b['sesSha256']:assert a['stats']==b['stats'],(file,repeat,'same-session stats')
  row={'repeat':repeat,'same_ses':a['sesSha256']==b['sesSha256'],'before':a,'after':b};records.append(row)
  if b['report']['incompleteAfter']>a['report']['incompleteAfter']:regressions.append({'file':file,**row})
 summary={mode:{'median_s':median(r[mode]['seconds']for r in records),'p95_s':max(r[mode]['seconds']for r in records),'opens':[r[mode]['report']['incompleteAfter']for r in records],'vias':[r[mode]['stats']['barrels']['total']for r in records],'length_mm':[r[mode]['stats']['tracks']['totalLengthMm']for r in records]}for mode in ['before','after']}
 pairs.append({'file':Path(file).name,'summary':summary,'all_same_sessions':all(r['same_ses']for r in records),'repeats':records})
out.write_text(json.dumps({'scope':'Three paired engine-only repeats/input; no native DRC or causal timing claim','pairs':pairs,'regressions':regressions},indent=2)+'\n')
print(json.dumps({'regressions':len(regressions),'pairs':[{k:v for k,v in p.items()if k!='repeats'}for p in pairs]}))
