"""Native deletion diagnostic; does not route or establish a production safety gate."""
import re,json,subprocess,hashlib,shutil
from pathlib import Path
import pcbnew
# Configured by the command-line entrypoint or verifier.
D=Path(__file__).resolve().parent
SRC=D/'board.kicad_pcb'
TARGET='40448888-06d6-474b-a038-09dfd03ed49c'
def parse(s):
 stack=[]
 for t in re.findall(r'"(?:\\.|[^"\\])*"|[()]|[^\s()]+',s):
  if t=='(':
   n=[]
   if stack:stack[-1].append(n)
   stack.append(n)
  elif t==')':root=stack.pop()
  else:stack[-1].append(t)
 return root
def dump(n):return '('+' '.join(map(dump,n))+')' if isinstance(n,list) else n
def child(n,k):return next((x for x in n if isinstance(x,list) and x[0]==k),None)
def uid(n):
 u=child(n,'uuid');return u[1].strip('"') if u else None
def check(nodes,name):
 out=D/name;out.mkdir(exist_ok=False)
 board=out/'board.kicad_pcb';board.write_text(dump(nodes)+'\n')
 for ext in ['.kicad_pro','.kicad_dru']:shutil.copyfile(SRC.with_suffix(ext),board.with_suffix(ext))
 cmd=['kicad-cli','pcb','drc','--refill-zones','--save-board','--severity-all','--format','json','-o',str(out/'drc.json'),str(board)]
 p=subprocess.run(cmd,capture_output=True,text=True,timeout=120)
 (out/'native.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
 r=json.loads((out/'drc.json').read_text())
 target=[v for v in r['violations'] if v['type']=='starved_thermal' and any(i['uuid']==TARGET for i in v['items'])]
 counts={k:sum(isinstance(n,list) and n[0]==k for n in nodes) for k in ['footprint','segment','via','zone']}
 row=dict(name=name,counts=counts,target=target,errors=[v for v in r['violations'] if v['severity']=='error'],opens=len(r['unconnected_items']))
 print(json.dumps(dict(name=name,counts=counts,target=len(target),errors=len(row['errors']),opens=row['opens'])),flush=True)
 return row
