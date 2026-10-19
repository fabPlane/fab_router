"""Reconstruct combined discovery and every decision from retained native evidence."""
import argparse,json
from pathlib import Path
import complete as m
p=argparse.ArgumentParser();p.add_argument('--results',type=Path,required=True);x=p.parse_args()
root=x.results/'native';z=json.loads((root/'summary.json').read_text())
assert not z['production_fix'] and not z['routing_benchmark'] and z['native_version']=='10.0.6'
def source(role,ext='.kicad_pcb'):
 matches=[d for name,d in z['source_sha256'].items() if role in name and name.endswith(ext)]
 assert len(matches)==1
 return (root/'sources'/matches[0]).read_bytes()
for digest in z['source_sha256'].values():assert m.sha((root/'sources'/digest).read_bytes())==digest
original=source('original-segment');input_bytes=source('original-input')
ids={m.native.uid(n) for n in m.native.parse(input_bytes.decode()) if isinstance(n,list)}
checks=0;opens=0;errors=0
def evidence(name,data,row,exception=None):
 global checks,opens,errors
 saved=(root/name/'board.kicad_pcb').read_bytes()
 same=m.transaction.identity.design_signature(saved)==m.transaction.identity.design_signature(data)
 report=json.loads((root/name/'drc.json').read_text())
 checks+=1;opens+=len(report['unconnected_items']);errors+=sum(e['severity']=='error' for e in report['violations'])
 for ext in ('.kicad_pro','.kicad_dru'):assert (root/name/('board'+ext)).read_bytes()==source('original-segment',ext)
 if exception:
  assert exception=='ValueError' and not same
  return
 assert same
 assert row['errors']==[e for e in report['violations'] if e['severity']=='error']
 assert row['opens']==len(report['unconnected_items'])
 assert row['groups']==m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(root/name/'board.kicad_pcb')))
 assert not (m.transaction.identity.design_signature(input_bytes)-m.transaction.identity.design_signature(data))
for r in z['rows']:
 repeat=r['repeat'];evidence(f'baseline-{repeat}',original,r['baseline'])
 pending=[a for stage in r['stages'] for a in stage['attempts']]
 consumed=[]
 def check(data,name):
  a=pending.pop(0);consumed.append(a)
  assert name==a['name'] and m.sha(data)==a['candidate_sha256']
  name=f'repeat-{repeat}-{name}'
  assert (root/(name+'.proposal.kicad_pcb')).read_bytes()==data
  evidence(name,data,a['row'],a['exception'])
  if a['exception']:raise ValueError('archived saved-design mismatch')
  return a['row']
 output,clean,stages=m.repair(original,r['baseline'],lambda data,row:m.candidates(data,row,ids),check,8)
 assert not pending and stages==r['stages']
 assert clean==r['clean'] and m.sha(output)==r['selected_sha256']
 assert (root/f'selected-{repeat}.kicad_pcb').read_bytes()==output
 assert clean and len(stages)==2
 final=stages[-1]['attempts'][-1]['row']
 assert not final['errors'] and final['opens']==0 and final['groups']==r['baseline']['groups']
assert len(z['rows'])==3 and len({r['selected_sha256'] for r in z['rows']})==1
print(f'PASS: 3 complete selections; {checks} native checks; {errors} aggregate errors; {opens} aggregate opens')
print('PASS: reconstructed proposals/decisions; saved design/rules; exact terminal partitions; original nodes; source hashes')
