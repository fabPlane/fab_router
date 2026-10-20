"""Replay retained reports; does not perform a fresh native check."""
import json,sys,pathlib,hashlib,importlib.util,collections
root=pathlib.Path(sys.argv[1]);repo=pathlib.Path(sys.argv[2])
spec=importlib.util.spec_from_file_location('proposal',repo/'tools/native-thermal-proposals.py');sx=importlib.util.module_from_spec(spec);sys.modules['proposal']=sx;spec.loader.exec_module(sx)
def groups(path):return {v:i for i,g in enumerate(json.loads(path.read_text())) for v in g}
def pairs(path):
 gs=json.loads(path.read_text());return {(a,b) for g in gs for i,a in enumerate(g) for b in g[i+1:]}
def normal(n):
 if not isinstance(n,list):
  try:return str(float(n))
  except ValueError:return n
 return [normal(v) for v in n]
def copper(n):return isinstance(n,list) and n[0] in ('segment','arc','via')
def sig(n):return json.dumps([n[0],sorted([normal(v) for v in n[1:] if not isinstance(v,list) or v[0]!='uuid'],key=str)])
for dirname in ['minimized','recheck']:
 d=root/dirname;rows=json.loads((d/'results.json').read_text());base=d/('source' if dirname=='minimized' else 'source-0');before=pairs(base/'groups.json')
 source=sx.parse((base/'board.kicad_pcb').read_text());sourcec=collections.Counter(sig(n) for n in source if copper(n))
 for row in rows:
  p=d/row['name'];report=json.loads((p/'drc.json').read_text());m=groups(p/'groups.json')
  assert row['opens']==len(report['unconnected_items'])
  assert row['errors']==[v['type'] for v in report['violations'] if v['severity']=='error']
  assert row['lost_pairs']==sum(m[a]!=m[b] for a,b in before)
  c=sx.parse((p/'board.kicad_pcb').read_text());cc=collections.Counter(sig(n) for n in c if copper(n));assert not sourcec-cc
  assert sum((cc-sourcec).values())==row['added']
  for ext in ['.kicad_pro','.kicad_dru']:assert (p/('board'+ext)).read_bytes()==(base/('board'+ext)).read_bytes()
 if dirname=='recheck':
  for row in rows:
   name=row['name'].split('-')[0];assert (row['added'],row['opens'],len(row['errors']),row['lost_pairs'])=={'source':(0,110,0,0),'full':(466,15,6,348),'reduced':(1,111,1,0)}[name]
 print(dirname,len(rows),'native reports: PASS')
selected=json.loads((root/'minimized/selected-copper.json').read_text());assert len(selected)==1
track=selected[0];assert sx.child(track,'start')[2]==sx.child(track,'end')[2]
assert list(sx.paths((176.1396,49.5902),(174.03,49.5902)))==[]
print('single axial segment; current detour family has zero paths: CONFIRMED')
