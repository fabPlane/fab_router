"""Offline deletion diagnostic. Every candidate retains source board geometry.
No candidate is a routing improvement; removing generated copper may add opens.
"""
import collections, importlib.util, json, pathlib, re, shutil, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('sexpr', ROOT.parent/'c199/sexpr-old.py'); sx=importlib.util.module_from_spec(spec);spec.loader.exec_module(sx)
spec=importlib.util.spec_from_file_location('groups', pathlib.Path('/home/hyper/bench/wt/fr-bugs/tools/native-terminal-groups.py')); gp=importlib.util.module_from_spec(spec);spec.loader.exec_module(gp)
SOURCE=pathlib.Path('/home/hyper/bench/wt/fp-bugs/benchmarks/autorouter/cases/kitspace-aquarius-j4/board.kicad_pcb')
CANDIDATE=ROOT.parent/'c196/full-after/runs/run-20261019T211154.565516Z-004/fab-router/final.kicad_pcb'
OUT=ROOT/'minimized';OUT.mkdir(exist_ok=False)
source=sx.parse(SOURCE.read_text()); candidate=sx.parse(CANDIDATE.read_text())
iscopper=lambda n:isinstance(n,list) and n[0] in ('segment','arc','via')
def norm(n):
 if not isinstance(n,list):
  try:return str(float(n))
  except ValueError:return n
 return [norm(v) for v in n]
def signature(n):return json.dumps([n[0], sorted([norm(v) for v in n[1:] if not isinstance(v,list) or v[0]!='uuid'],key=str)])
remaining=collections.Counter(signature(n) for n in source if iscopper(n));added=[]
for n in candidate:
 if not iscopper(n):continue
 k=signature(n)
 if remaining[k]:remaining[k]-=1
 else:added.append(n)
assert not +remaining, +remaining
print('added',len(added),flush=True)
rows=[];cache={}
def inspect(indices,name):
 d=OUT/name;d.mkdir();board=d/'board.kicad_pcb';board.write_text(sx.dump(source+[added[i] for i in indices])+'\n')
 for ext in ('.kicad_pro','.kicad_dru'):
  f=SOURCE.with_suffix(ext)
  if f.exists():shutil.copyfile(f,board.with_suffix(ext))
 p=subprocess.run(['timeout','120','kicad-cli','pcb','drc','--severity-all','--format','json','--units','mm','--refill-zones','--save-board','--output',str(d/'drc.json'),str(board)],capture_output=True,text=True,timeout=130)
 (d/'native.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
 groups=gp.terminal_groups(str(board));(d/'groups.json').write_text(json.dumps(groups)+'\n')
 membership={v:i for i,g in enumerate(groups) for v in g}; report=json.loads((d/'drc.json').read_text())
 row=dict(name=name,indices=indices,added=len(indices),opens=len(report['unconnected_items']),errors=[v['type'] for v in report['violations'] if v['severity']=='error'])
 if rows:
  assert set(membership)==set(before)
  row['lost_pairs']=sum(membership[a]!=membership[b] for group in baseline for i,a in enumerate(group) for b in group[i+1:])
 else:row['lost_pairs']=0
 rows.append(row);(OUT/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(row,flush=True)
 return groups,row
baseline,_=inspect([],'source');before={v:i for i,g in enumerate(baseline) for v in g}
def loses(indices):
 key=tuple(indices)
 if key not in cache:
  _,r=inspect(indices,f'trial-{len(cache):03}');cache[key]=r['errors'].count('starved_thermal')>0
 return cache[key]
current=list(range(len(added)));assert loses(current)
n=2
while len(current)>=2:
 chunks=[current[i::n] for i in range(n)];found=False
 for chunk in chunks:
  complement=[i for i in current if i not in chunk]
  if complement and loses(complement):current=complement;n=max(2,n-1);found=True;break
 if found:continue
 if n==len(current):break
 n=min(len(current),n*2)
assert all(not loses([i for i in current if i!=remove]) for remove in current)
for r in range(3):inspect(current,f'final-{r}')
(OUT/'summary.json').write_text(json.dumps(dict(added_before=len(added),added_after=len(current),indices=current,one_minimal=True,production_fix=False,router_rerun=False),indent=2)+'\n')
(OUT/'selected-copper.json').write_text(json.dumps([added[i] for i in current],indent=2)+'\n')
