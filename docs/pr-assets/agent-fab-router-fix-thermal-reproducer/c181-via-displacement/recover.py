"""Recover rows from completed native checks after the strict repeat assertion failed.

Does not execute any native refill or change its findings. Exact repeat equality
is reported separately instead of discarding completed evidence.
"""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);x=p.parse_args()
rows=[]
for label in ('reduced','full'):
 for repeat in range(3):
  baseline=None
  for index,offset in enumerate([(0,0),(.5,0),(-.5,0),(0,.5),(0,-.5),(1,0),(-1,0),(0,1),(0,-1)]):
   name=f'{label}-{repeat}-{index}';d=x.out/name
   data=(x.out/(name+'.kicad_pcb')).read_bytes();saved=d/'board.kicad_pcb'
   faithful=m.transaction.identity.design_signature(data)==m.transaction.identity.design_signature(saved.read_bytes())
   report=json.loads((d/'drc.json').read_text());nodes=m.native.parse(data.decode())
   row=dict(name=name,counts={k:sum(isinstance(n,list) and n[0]==k for n in nodes) for k in ('footprint','segment','via','zone')},target=[v for v in report['violations'] if v['type']=='starved_thermal' and any(i['uuid']==m.native.TARGET for i in v['items'])],errors=[v for v in report['violations'] if v['severity']=='error'],opens=len(report['unconnected_items']))
   if faithful:row['groups']=m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(saved)))
   else:row=None
   if index==0:baseline=row
   lost=m.transaction.terminals.lost_pairs(baseline['groups'],row['groups']) if row else None
   accepted=bool(row and m.transaction.errors(row)<m.transaction.errors(baseline) and row['groups'].keys()==baseline['groups'].keys() and not lost and row['opens']<=baseline['opens'])
   rows.append(dict(label=label,repeat=repeat,offset=list(offset),name=name,row=row,failure=None if faithful else 'checked board differs from proposed design',lost_pairs=lost,accepted=accepted))
(x.out/'summary.json').write_text(json.dumps(dict(rows=rows,production_fix=False,routing_benchmark=False,recovered_from_completed_reports=True),indent=2)+'\n')
for label in ('reduced','full'):
 for i in range(9):
  group=[r for r in rows if r['label']==label and int(r['name'].split('-')[-1])==i]
  signatures=[json.dumps({k:v for k,v in r['row'].items() if k!='name'},sort_keys=True) if r['row'] else None for r in group]
  print(label,group[0]['offset'],'exact_repeat',len(set(signatures))==1,'outcomes',[(len(r['row']['errors']),r['row']['opens'],r['lost_pairs'],r['accepted']) if r['row'] else 'INVALID' for r in group])
