#!/usr/bin/python3
"""Reduce generated-copper additions; retain intact original native design."""
import argparse, importlib.util, json, gzip, hashlib
from pathlib import Path
p=Path(__file__).resolve().parent.parent/'c165-thermal-causes/isolate.py'
s=importlib.util.spec_from_file_location('isolate',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
a=argparse.ArgumentParser(description=__doc__)
a.add_argument('--input',type=Path,required=True);a.add_argument('--routed',type=Path,required=True);a.add_argument('--out',type=Path,required=True)
x=a.parse_args();x.out.mkdir(parents=True,exist_ok=False)
assert m.native.pcbnew.Version()=='10.0.6'
for ext in ['.kicad_pro','.kicad_dru']:assert x.input.with_suffix(ext).read_bytes()==x.routed.with_suffix(ext).read_bytes()
original=x.input.read_bytes();nodes=m.native.parse(original.decode());rnodes=m.native.parse(x.routed.read_text())
added=m.added_items(m.native.pcbnew.LoadBoard(str(x.input)),m.native.pcbnew.LoadBoard(str(x.routed)))
byid={m.native.uid(n):n for n in rnodes if isinstance(n,list) and n[0] in ('segment','via','arc')}
m.native.SRC=x.input;m.native.D=x.out
rows=[];target=None

def check(selected,label):
 global target
 name=f'{len(rows):03}-{label}';candidate=(m.native.dump(nodes+[byid[i] for i in selected])+'\n').encode()
 row=m.native.check(m.native.parse(candidate.decode()),name)
 saved=(x.out/name/'board.kicad_pcb').read_bytes()
 preserved=m.identity.design_signature(candidate)==m.identity.design_signature(saved)
 keys=sorted(m.error_key(e) for e in row['errors'])
 if label=='all':
  assert preserved and len(keys)==1 and keys[0][0]=='starved_thermal';target=keys
 if label=='original':assert preserved and not keys
 for ext in ['.kicad_pro','.kicad_dru']:assert (x.out/name/'board.kicad_pcb').with_suffix(ext).read_bytes()==x.input.with_suffix(ext).read_bytes()
 (x.out/name/'proposal.kicad_pcb.gz').write_bytes(gzip.compress(candidate,mtime=0))
 row.update(selected=selected,design_preserved=preserved,proposed_sha256=hashlib.sha256(candidate).hexdigest(),saved_sha256=hashlib.sha256(saved).hexdigest())
 rows.append(row)
 (x.out/'progress.json').write_text(json.dumps(rows,indent=2)+'\n')
 return preserved and keys==target

check([],'original');assert check(added,'all')
current=added[:]
segments=[i for i in added if byid[i][0]=='segment']
if check(segments,'segments-only'):current=segments
n=2
while len(current)>=2:
 chunks=[current[i*len(current)//n:(i+1)*len(current)//n] for i in range(n)]
 reduced=False
 for chunk in chunks:
  if check(chunk,'chunk'):current=chunk;n=max(2,n-1);reduced=True;break
 if not reduced:
  for chunk in chunks:
   complement=[i for i in current if i not in chunk]
   if complement and check(complement,'complement'):current=complement;n=max(2,n-1);reduced=True;break
 if not reduced:
  if n==len(current):break
  n=min(len(current),n*2)
# Explicit repeated positive and removal controls, including baseline/full.
for repeat in range(3):
 check([],f'control-original-{repeat}');assert check(added,f'control-all-{repeat}')
 assert check(current,f'control-minimal-{repeat}')
 for item in current:assert not check([i for i in current if i!=item],f'control-remove-{repeat}')
summary=dict(production_fix=False,routing_benchmark=False,native_version=m.native.pcbnew.Version(),added=[dict(uuid=i,node=byid[i]) for i in added],minimal=current,rows=rows,source_sha256={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for b in (x.input,x.routed) for p in (b,b.with_suffix('.kicad_pro'),b.with_suffix('.kicad_dru'))})
(x.out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print('PASS',len(rows),'checks;',len(current),'minimal additions',current)
