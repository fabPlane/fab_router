"""Verify isolated-via drift and retained native controls without rerouting."""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p=argparse.ArgumentParser();p.add_argument('--results',type=Path,required=True);x=p.parse_args()
z=json.loads((x.results/'summary.json').read_text())
source=(x.results/'source/board.kicad_pcb').read_bytes();original=(x.results/'input/board.kicad_pcb').read_bytes()
nodes=m.native.parse(source.decode());inp=m.native.parse(original.decode())
via=next(n for n in nodes if isinstance(n,list) and m.native.uid(n)==m.native.uid(z['via']))
assert via==z['via']
expected={'original':original,'full':source,'singleton':(m.native.dump(inp+[via])+'\n').encode(),'removed':(m.native.dump([n for n in nodes if n is not via])+'\n').encode()}
for label,data in expected.items():assert (x.results/(label+'.kicad_pcb')).read_bytes()==data
for r in z['rows']:
 label=r['label'];name=f"{label}-{r['repeat']}"
 proposal=(x.results/(label+'.kicad_pcb')).read_bytes()
 saved=(x.results/name/'board.kicad_pcb').read_bytes()
 a=m.transaction.identity.design_signature(proposal);b=m.transaction.identity.design_signature(saved)
 report=json.loads((x.results/name/'drc.json').read_text())
 if label=='singleton':
  assert r['row'] is None and r['failure']=='checked board differs from proposed design'
  assert sum((a-b).values())==sum((b-a).values())==1
  before=next(iter(a-b));after=next(iter(b-a))
  assert before[0]==after[0]=='via'
  assert m.native.uid(z['via'])=='d3812c01-5e0b-47fa-b2de-04d261bdf01e'
  assert [n for n in before if n[0]!='net']==[n for n in after if n[0]!='net']
  assert ('net','"Net-(C2-Pad1)"') in before and ('net','"GNDD"') in after
 else:
  assert a==b and r['failure'] is None
  assert (len(r['row']['errors']),r['row']['opens'])=={'original':(0,110),'full':(6,15),'removed':(5,16)}[label]
  assert r['row']['errors']==[v for v in report['violations'] if v['severity']=='error']
  assert r['row']['opens']==len(report['unconnected_items'])
  assert r['row']['groups']==m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(x.results/name/'board.kicad_pcb')))
 for ext in ('.kicad_pro','.kicad_dru'):
  assert (x.results/name/('board'+ext)).read_bytes()==(x.results/'source'/('board'+ext)).read_bytes()
print('PASS: 12 native records; singleton changes exactly one via net in each repeat')
