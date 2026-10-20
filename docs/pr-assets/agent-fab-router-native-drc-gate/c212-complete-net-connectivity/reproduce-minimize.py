"""Offline deletion diagnostic. Every candidate retains source board geometry.
No candidate is a routing improvement; removing generated copper may add opens.
"""
import argparse
import collections, importlib.util, json, pathlib, re, shutil, subprocess, sys
parser=argparse.ArgumentParser();parser.add_argument('--repo',type=pathlib.Path,required=True);parser.add_argument('--out',type=pathlib.Path,required=True);args=parser.parse_args()
REPO=args.repo.resolve();ROOT=args.out.resolve();ROOT.mkdir(parents=True,exist_ok=False)
spec=importlib.util.spec_from_file_location('sexpr', REPO/'tools/native-thermal-proposals.py'); sx=importlib.util.module_from_spec(spec);sys.modules[spec.name]=sx;spec.loader.exec_module(sx)
spec=importlib.util.spec_from_file_location('groups', REPO/'tools/native-terminal-groups.py'); gp=importlib.util.module_from_spec(spec);spec.loader.exec_module(gp)
import gzip
FIXTURE=REPO/'test/fixtures/native-aquarius-thermal'
SOURCE=FIXTURE/'board.kicad_pcb'
OUT=ROOT/'minimized';OUT.mkdir(exist_ok=False)
source=sx.parse(gzip.decompress((FIXTURE/'input.kicad_pcb.gz').read_bytes()).decode())
full=sx.parse('(kicad_pcb '+gzip.decompress((FIXTURE/'full-added.sexpr.gz').read_bytes()).decode()+')')[1:]
nets=collections.defaultdict(list)
for node in full:
 net=next(v[1] for v in node if isinstance(v,list) and v[0]=='net')
 nets[net].append(node)
names=sorted(nets)
added=[nets[name] for name in names]
(OUT/'nets.json').write_text(json.dumps({name:len(nets[name]) for name in names},indent=2)+'\n')
print('complete nets',len(added),'items',len(full),flush=True)
rows=[];cache={}
def inspect(indices,name):
 d=OUT/name;d.mkdir();board=d/'board.kicad_pcb';board.write_text(sx.dump(source+[node for i in indices for node in added[i]])+'\n')
 for ext in ('.kicad_pro','.kicad_dru'):
  f=FIXTURE/('board'+ext)
  if f.exists():shutil.copyfile(f,board.with_suffix(ext))
 p=subprocess.run(['timeout','120','kicad-cli','pcb','drc','--severity-all','--format','json','--units','mm','--refill-zones','--save-board','--output',str(d/'drc.json'),str(board)],capture_output=True,text=True,timeout=130)
 (d/'native.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
 groups=gp.terminal_groups(str(board));(d/'groups.json').write_text(json.dumps(groups)+'\n')
 membership={v:i for i,g in enumerate(groups) for v in g}; report=json.loads((d/'drc.json').read_text())
 row=dict(name=name,indices=indices,added=sum(len(added[i]) for i in indices),nets=[names[i] for i in indices],opens=len(report['unconnected_items']),errors=[v['type'] for v in report['violations'] if v['severity']=='error'])
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
  _,r=inspect(indices,f'trial-{len(cache):03}');cache[key]=r['lost_pairs']>0
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
(OUT/'selected-copper.json').write_text(json.dumps([node for i in current for node in added[i]],indent=2)+'\n')
(OUT/'selected.sexpr').write_text('\n'.join(sx.dump(node) for i in current for node in added[i])+'\n')
