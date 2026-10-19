"""Report all completed slow-case differences against retained enabled evidence.
Historical single evaluations with timed budgets; this is not a fresh paired timing claim.
"""
from pathlib import Path
import json,sys
old,new,out=map(Path,sys.argv[1:]);assert not out.exists()
a=json.loads(old.read_text());b=json.loads(new.read_text());assert b['complete']and b['total']==63
before={r['result']['id']:r['result']for r in a['rows']if r['mode']=='candidate'};after=b['rows']
assert len(before)==len(after)==63 and set(before)=={r['id']for r in after}
rows=[];adverse=[]
for r in after:
 p=before[r['id']];assert p['expected']==r['expected']and p['kind']==r['kind']
 x,y=p['measured'],r['measured']
 diff={k:{'before':x.get(k),'after':y.get(k)}for k in set(x)|set(y)if x.get(k)!=y.get(k)}
 row={'id':r['id'],'before_pass':p['pass'],'after_pass':r['pass'],'before_ms':p['ms'],'after_ms':r['ms'],'measured_differences':diff,'mismatches':r['mismatches']}
 rows.append(row)
 bad=(p['pass']and not r['pass'])or y.get('incomplete',0)>x.get('incomplete',0)or y.get('violationsAdded',0)>x.get('violationsAdded',0)or (y.get('aborted',False)and not x.get('aborted',False))or any(k.startswith('invariant:')and v is False for k,v in y.items())
 if bad:adverse.append(row)
summary={m:{'passed':sum(r['pass']for r in rr),'failed':sum(not r['pass']for r in rr),'advisory':sum(bool(r['advisoryMismatches'])for r in rr),'stubbed':sum(r['stub']for r in rr),'total_s':sum(r['ms']for r in rr)/1000}for m,rr in [('before',list(before.values())),('after',after)]}
out.write_text(json.dumps({'scope':'Historical cycle32 enabled versus current enabled;63 unchanged expectations;1 evaluation/case;concurrent work;adverse differences retained;no all-input nonregression or causal timing claim','summary':summary,'adverse':adverse,'cases':rows},indent=2)+'\n');print(json.dumps({'summary':summary,'adverse':len(adverse)}))
