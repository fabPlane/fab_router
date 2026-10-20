"""Compare native warning geometry while preserving positions and multiplicity.
Imported copper receives fresh UUIDs, so UUID equality cannot identify new findings.
This does not alter the checker or its error acceptance policy.
"""
from pathlib import Path
from collections import Counter
import copy,json,sys
before,after,out=map(Path,sys.argv[1:]);assert not out.exists()
def canonical(x):
 x={k:v for k,v in x.items()if k!='uuid'}
 if 'items'in x:x['items']=sorted([canonical(y)for y in x['items']],key=lambda y:json.dumps(y,sort_keys=True))
 return x
def count(xs):return Counter(json.dumps(canonical(x),sort_keys=True)for x in xs)
# Deliberate controls: UUID/order changes pass; displaced or duplicated findings differ.
a={'type':'spacing','severity':'warning','description':'real clearance','items':[{'uuid':'a','pos':{'x':1,'y':2}},{'uuid':'b','pos':{'x':3,'y':4}}]}
b=copy.deepcopy(a);b['items'].reverse();b['items'][0]['uuid']='new';assert count([a])==count([b])
b['items'][0]['pos']['x']+=1;assert count([a])!=count([b]);assert count([a,a])-count([a])
old={(r['case'],r['seed']):r for r in json.loads((before/'results.json').read_text())};new=json.loads((after/'results.json').read_text());assert len(old)==len(new)==78
changes=[];same_types=True
for row in new:
 a=old[(row['case'],row['seed'])];xs=a['check'].get('new_warning_details',[]);ys=row['check'].get('new_warning_details',[])
 same_types=same_types and Counter(x['type']for x in xs)==Counter(x['type']for x in ys)
 added=list((count(ys)-count(xs)).elements())
 if added:changes.append({'case':row['case'],'seed':row['seed'],'added_warning_geometry':[json.loads(x)for x in added]})
result={'compared_runs':78,'canonicalisation':'Ignore random imported-item UUIDs only; sort item order; retain exact positions, descriptions, severity, type and multiplicity','controls_passed':['UUID/order equality','position mutation rejected','duplicate finding rejected'],'per_type_counts_identical_all_pairs':same_types,'changes':changes}
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
