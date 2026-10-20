"""Compare completed current slow acceptance against the retained prior enabled sweep.
Timed single evaluations cannot establish causal time or all-input nonregression.
"""
from pathlib import Path
import gzip,json,sys
old,new,out=map(Path,sys.argv[1:]);assert not out.exists()
load=lambda p:json.loads(gzip.decompress(p.read_bytes())if p.suffix=='.gz'else p.read_bytes())
a,b=map(load,[old,new]);assert a['complete']and b['complete']and a['total']==b['total']==63
before={r['id']:r for r in a['rows']};after=b['rows'];assert len(before)==len(after)==63
rows=[];adverse=[]
for r in after:
 p=before[r['id']];assert p['expected']==r['expected']and p['kind']==r['kind']
 x,y=p['measured'],r['measured'];diff={k:{'before':x.get(k),'after':y.get(k)}for k in set(x)|set(y)if x.get(k)!=y.get(k)}
 row={'id':r['id'],'before_pass':p['pass'],'after_pass':r['pass'],'before_ms':p['ms'],'after_ms':r['ms'],'measured_differences':diff,'mismatches':r['mismatches']};rows.append(row)
 if (p['pass']and not r['pass'])or y.get('incomplete',0)>x.get('incomplete',0)or y.get('violationsAdded',0)>x.get('violationsAdded',0)or (y.get('aborted',False)and not x.get('aborted',False))or any(k.startswith('invariant:')and v is False for k,v in y.items()):adverse.append(row)
summary={mode:{'passed':sum(r['pass']for r in rr),'failed':sum(not r['pass']for r in rr),'advisory':sum(bool(r['advisoryMismatches'])for r in rr),'stubbed':sum(r['stub']for r in rr),'total_s':sum(r['ms']for r in rr)/1000}for mode,rr in [('before',list(before.values())),('after',after)]}
out.write_text(json.dumps({'scope':'Historical matching-pin enabled control versus fresh bounded quilt front-cache enabled sweep; unchanged63 expectations;one evaluation/case;different run dates;no causal timing/all-input nonregression claim','summary':summary,'adverse':adverse,'cases':rows},indent=2)+'\n')
print(json.dumps({'summary':summary,'adverse':len(adverse)}))
