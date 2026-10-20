"""Independent retained-report replay; never a fresh native or scored run."""
import json,sys,pathlib,importlib.util,collections,hashlib
root=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('sx',root/'helpers/sexpr-old.py');sx=importlib.util.module_from_spec(spec);spec.loader.exec_module(sx)
def groups(p):
 gs=json.loads(p.read_text());m={x:i for i,g in enumerate(gs) for x in g};assert len(m)==sum(map(len,gs));return gs,m
def copper(n):return isinstance(n,list) and n[0] in ('segment','arc','via')
def normal(n):
 if not isinstance(n,list):
  try:return str(float(n))
  except ValueError:return n
 return [normal(x) for x in n]
def sig(n):return json.dumps([n[0],sorted([normal(x) for x in n[1:] if not isinstance(x,list) or x[0]!='uuid'],key=str)])
summary=json.loads((root/'minimized/summary.json').read_text());assert summary['added_before']==466 and summary['added_after']==3 and summary['one_minimal']
selected=summary['indices'];assert selected==[83,169,375]
for dirname in ['minimized','recheck']:
 d=root/dirname;rows=json.loads((d/'results.json').read_text());base=d/('source' if dirname=='minimized' else 'source-0');bg,bm=groups(base/'groups.json');pairs={(a,b) for g in bg for i,a in enumerate(g) for b in g[i+1:]};source=sx.parse((base/'board.kicad_pcb').read_text());bc=collections.Counter(sig(n) for n in source if copper(n))
 for row in rows:
  p=d/row['name'];report=json.loads((p/'drc.json').read_text());cg,cm=groups(p/'groups.json');assert set(cm)==set(bm)
  lost={(a,b) for a,b in pairs if cm[a]!=cm[b]}
  assert row['lost_pairs']==len(lost)
  assert row['opens']==len(report['unconnected_items'])
  assert row['errors']==[v['type'] for v in report['violations'] if v['severity']=='error']
  board=sx.parse((p/'board.kicad_pcb').read_text());cc=collections.Counter(sig(n) for n in board if copper(n));assert not bc-cc;assert sum((cc-bc).values())==row['added']
  for ext in ['.kicad_pro','.kicad_dru']:assert (p/('board'+ext)).read_bytes()==(base/('board'+ext)).read_bytes()
  if row['indices']==selected:
   assert (row['opens'],row['errors'],row['lost_pairs'])==(114,['starved_thermal'],61)
   assert all(any(json.loads(x)[1]=='U1' and json.loads(x)[4]=='39' for x in pair) for pair in lost)
  if dirname=='recheck':
   expected={'source':(0,110,[],0),'full':(466,15,['starved_thermal']*6,348),'reduced':(3,114,['starved_thermal'],61)}[row['name'].split('-')[0]]
   assert (row['added'],row['opens'],row['errors'],row['lost_pairs'])==expected
 if dirname=='minimized':
  assert len(rows)==74
  for remove in selected:
   deletion=[x for x in selected if x!=remove];assert any(r['indices']==deletion and r['lost_pairs']==0 for r in rows)
 else:assert len(rows)==9
 print(dirname,len(rows),'native reports: PASS')
print('one-deletion-minimal 3-track cut; U1.39 loses all 61 source peers: PASS')
