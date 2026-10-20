"""Independent Decimal inventory, report and terminal-partition replay."""
import pathlib,sys,json,collections,gzip
from decimal import Decimal,InvalidOperation
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent));import sexpr as sx
r=pathlib.Path(sys.argv[1])
def atom(n):
 if isinstance(n,list):return tuple(atom(v) for v in n)
 try:return Decimal(n)
 except InvalidOperation:return n
def inventory(board):
 names={'0':'""'}
 for n in board:
  if isinstance(n,list) and n[0]=='net' and len(n)==3:names[n[1]]=n[2]
 out=collections.Counter()
 for n in board:
  if not isinstance(n,list) or n[0] not in ['segment','arc','via']:continue
  field=sx.child(n,'net');net=names.get(field[1],field[1]) if field else '""';fields=[]
  for f in n[1:]:
   if isinstance(f,list) and f[0] in ['start','end','mid','at','width','size','drill','layer','layers']:
    tag='endpoint' if n[0] in ['segment','arc'] and f[0] in ['start','end'] else f[0]
    fields.append((tag,atom(f[1:])))
  out[(n[0],net,tuple(sorted(fields,key=repr)))]+=1
 return out
def pairs(groups):return {tuple(sorted((a,b))) for g in groups for i,a in enumerate(g) for b in g[i+1:]}
source=sx.parse(gzip.decompress((r/'fixture/input.kicad_pcb.gz').read_bytes()).decode());sp=pairs(json.loads((r/'source-groups.json').read_text()));rows=[]
for filename in ['results.json','detour-results.json','stitch-results.json','via-results.json','joint55-results.json','outer-elbow-results.json']:
 for row in json.loads((r/filename).read_text()):
  out=r/row['name'];extras=sx.parse('(kicad_pcb '+(out/'added.sexpr').read_text()+')')[1:]
  submitted=inventory(source+extras);saved=inventory(sx.parse((out/'board.kicad_pcb').read_text()))
  rep=json.loads((out/'drc.json').read_text());groups=json.loads((out/'groups.json').read_text());lost=sp-pairs(groups)
  assert len(lost)==row['lost_pairs'];assert len(rep['unconnected_items'])==row['opens']
  assert [v['type'] for v in rep['violations'] if v['severity']=='error']==row['errors']
  rows.append(dict(name=row['name'],items=len(extras),ownershipPreserved=submitted==saved,opens=row['opens'],errors=row['errors'],lostSourcePairs=len(lost)))
before=pairs(json.loads((r/'before/groups.json').read_text()));after=pairs(json.loads((r/'capacitor-via-up-0.1/groups.json').read_text()));restored=(sp-before)&after
assert len(restored)==57 and not before-after
assert all(any(json.loads(p)[1:2]==['U1'] and json.loads(p)[4]=='55' for p in pair) for pair in restored)
assert inventory(sx.parse((r/'strict/routed.kicad_pcb').read_text()))==inventory(sx.parse((r/'before/board.kicad_pcb').read_text()))
assert inventory(sx.parse((r/'strict/candidate.kicad_pcb').read_text()))==inventory(sx.parse((r/'capacitor-via-up-0.1/board.kicad_pcb').read_text()))
strict=[]
for row in json.loads((r/'strict/results.json').read_text()):
 raw=json.loads((r/'strict'/f"{row['name']}-{row['repeat']}.json").read_text());candidate=row['name']=='candidate'
 assert pairs(raw['terminalGroups']['input'])==sp
 assert pairs(raw['repair']['terminalGroups']['input'])==before
 assert pairs(raw['terminalGroups']['candidate'])==(after if candidate else before)
 reports=[raw['inputReport'],raw['candidateReport'],raw['repair']['routedReport']]
 assert len({v['kicad_version'] for v in reports})==1
 assert all(v['ignored_checks']==reports[0]['ignored_checks'] for v in reports)
 for relation in [raw,raw['repair']]:
  groups=relation['terminalGroups'];assert len(pairs(groups['input'])-pairs(groups['candidate']))==relation['lostTerminalPairs']
 def findings(report):
  return collections.Counter((v['type'],v['severity'],tuple(sorted((i['description'],Decimal(str(i['pos']['x'])),Decimal(str(i['pos']['y']))) for i in v['items']))) for v in report['violations'] if v['severity']=='error')
 assert sum((findings(raw['candidateReport'])-findings(raw['inputReport'])).values())==len(raw['newErrors'])
 assert sum((findings(raw['candidateReport'])-findings(raw['repair']['routedReport'])).values())==len(raw['repair']['newErrors'])
 assert len(raw['candidateReport']['unconnected_items'])==raw['opensAfter']
 assert raw['nativeCopperChecks']==[True,True,True] and not raw['accepted']
 assert raw['lostTerminalPairs']==(235 if candidate else 292) and raw['opensAfter']==(13 if candidate else 14)
 assert raw['repair']['lostTerminalPairs']==0 and raw['repair']['accepted']==(not candidate)
 assert len(raw['newErrors'])==(7 if candidate else 6) and all(e['type']=='starved_thermal' for e in raw['newErrors'])
 if candidate:
  assert len(raw['repair']['newErrors'])==1
  assert any(i['uuid']=='57ce983e-ec4e-48a5-9547-b23514d0d6a4' for i in raw['repair']['newErrors'][0]['items'])
 strict.append(row)
assert len(rows)==23 and len(strict)==6
result=dict(discovery=rows,strictDecisions=strict,restoredSourcePairs=57,lostCurrentPairs=0,allChecksPassed=True)
print(json.dumps(result,indent=2))
