"""Summarize retained native discovery; never infer scores from diagnostic probes."""
import argparse,json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c185-marker-causes'))
import measure as m
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
z=json.loads((x.root/'summary.json').read_text());r=z['repeats'][0]
nodes=m.native.parse((x.root/'source/board.kicad_pcb').read_text())
pads={m.native.uid(p):m.native.child(f,'property')[2].strip('"')+'.'+p[1].strip('"') for f in nodes if isinstance(f,list) and f[0]=='footprint' for p in f if isinstance(p,list) and p[0]=='pad'}
rows=[]
for a in r['discovery']:
    if not a['causal']:continue
    removed=m.transaction.errors(r['baseline'])-m.transaction.errors(a['row'])
    labels=sorted({pads[i['uuid']] for e in removed.elements() for i in json.loads(e)['items'] if i['uuid'] in pads})
    item=next(n for n in nodes if isinstance(n,list) and m.native.uid(n)==a['uid'])
    rows.append(dict(uid=a['uid'],kind=a['kind'],markers=labels,
        geometry={n[0]:n[1:] for n in item if isinstance(n,list) and n[0] not in ('uuid','net')},
        lost_pairs=m.transaction.terminals.lost_pairs(r['baseline']['groups'],a['row']['groups']),
        accepted_variants=[b['variant'] for b in r['attempts'] if b['uid']==a['uid'] and b['accepted']]))
faithful=[row for t in z['repeats'] for row in [t['baseline']]+[a['row'] for a in t['discovery']+t['attempts']] if row]
total=sum(1+len(t['discovery'])+len(t['attempts']) for t in z['repeats'])
summary=dict(scope='Offline complete-board native discovery, not scored routing',repeats=len(z['repeats']),native_checks=total,faithful_checks=len(faithful),identity_rejected=total-len(faithful),aggregate_errors=sum(len(row['errors']) for row in faithful),aggregate_opens=sum(row['opens'] for row in faithful),accepted=sum(a['accepted'] for t in z['repeats'] for a in t['attempts']),candidates_per_repeat=len(r['pool']),causes=rows,final=[dict(errors=len(t['final']['errors']),opens=t['final']['opens'],complete=t['complete']) for t in z['repeats']])
x.out.write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='causes'}))
