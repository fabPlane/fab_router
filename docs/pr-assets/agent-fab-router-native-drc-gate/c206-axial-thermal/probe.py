import importlib.util,json,shutil
from pathlib import Path
p=Path('/home/hyper/bench/wt/fr-bugs')
spec=importlib.util.spec_from_file_location('proposal',p/'tools/native-thermal-proposals.py');m=importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name]=m;spec.loader.exec_module(m)
r=Path('/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c206/probe');r.mkdir()
a=Path('/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c205/recheck')
for role,old in [('source','source-0'),('routed','reduced-0')]:
 for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru'):shutil.copyfile(a/old/('board'+ext),r/(role+ext))
def paths(a,b):
 dx,dy=b[0]-a[0],b[1]-a[1];length=abs(dx or dy);sx=1 if dx>0 else -1;sy=1 if dy>0 else -1
 for f in (.125,.25,.375):
  d=length*f
  for sign in (1,-1):
   if dx:yield [a,(a[0]+sx*d,a[1]+sign*d),(b[0]-sx*d,b[1]+sign*d),b]
   else:yield [a,(a[0]+sign*d,a[1]+sy*d),(b[0]+sign*d,b[1]-sy*d),b]
m.paths=paths
nodes=m.parse((r/'routed.kicad_pcb').read_text())
for i,data in enumerate(m.proposals(nodes,'9d2e32dc-507a-41da-b2b4-a62b38b96fca')):
 (r/f'{i}.kicad_pcb').write_bytes(data)
 for ext in ('.kicad_pro','.kicad_dru'):shutil.copyfile(r/('source'+ext),r/(str(i)+ext))
