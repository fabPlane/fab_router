"""Revalidate individually clean detours in sequence on a disposable full board."""
import argparse, hashlib, importlib.util, json, shutil
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c182-causal-detours'))
from probe import m, proposals
p=argparse.ArgumentParser();p.add_argument('--before',action='store_true');p.add_argument('--root',type=Path,required=True);p.add_argument('--helper',type=Path,required=True);x=p.parse_args()
if x.before:
    old_globals=dict(__file__=str(Path(__file__).resolve().parent.parent/'aquarius-reduced/transaction.py'))
    exec(compile((Path(__file__).resolve().parent/'transaction-before.py').read_text(),old_globals['__file__'],'exec'),old_globals)
    m.transaction.checked_native=old_globals['checked_native']
ind=json.loads((x.root/'summary.json').read_text());out=x.root/'composed';out.mkdir(exist_ok=False)
spec=importlib.util.spec_from_file_location('via_geometry',x.helper);g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
# Adapt only the old call signature; the old helper remains byte-for-byte archived.
import inspect
if 'protected_ids' not in inspect.signature(g.relocate).parameters:
    old_relocate=g.relocate
    g.relocate=lambda nodes,uid,dx,dy,*,protected_ids:old_relocate(nodes,uid,dx,dy)
m.native.SRC=x.root/'source/board.kicad_pcb';m.native.D=out
original_ids={m.native.uid(n) for n in m.native.parse((x.root/'input/board.kicad_pcb').read_text()) if isinstance(n,list)}
source=m.native.SRC.read_bytes();sha=lambda d:hashlib.sha256(d).hexdigest();repeats=[]
selected=[a for a in ind['repeats'][0]['attempts'] if a['accepted']]
for repeat in range(3):
    current=source;baseline=m.transaction.checked_native(current,f'baseline-{repeat}');initial=baseline;attempts=[]
    for index,entry in enumerate([None]+selected+[dict(label='U1.39',uid='21768f94-189f-4a8a-9f22-7e54b38c1a6d',delete=True)]):
        if entry is None:
            label='C1.2';data=(m.native.dump(g.relocate(m.native.parse(current.decode()),'d3812c01-5e0b-47fa-b2de-04d261bdf01e',.5,0,protected_ids=original_ids))+'\n').encode()
        else:
            label=entry['label']
            if entry.get('delete'):
                data=(m.native.dump([n for n in m.native.parse(current.decode()) if not (isinstance(n,list) and n[0]=='segment' and m.native.uid(n)==entry['uid'])])+'\n').encode()
            else:data=list(proposals(m.native.parse(current.decode()),entry['uid']))[entry['index']]
        name=f'step-{repeat}-{index}';(out/(name+'.proposal.kicad_pcb')).write_bytes(data)
        row=m.transaction.checked_native(data,name)
        lost=m.transaction.terminals.lost_pairs(baseline['groups'],row['groups'])
        accepted=bool(m.transaction.errors(row)<m.transaction.errors(baseline) and row['groups'].keys()==baseline['groups'].keys() and not lost and row['opens']<=baseline['opens'])
        attempts.append(dict(name=name,label=label,entry=entry,row=row,lost_pairs=lost,accepted=accepted,before_sha256=sha(current)))
        if accepted:current=data;baseline=row
    (out/f'selected-{repeat}.kicad_pcb').write_bytes(current)
    repeats.append(dict(baseline=initial,attempts=attempts,final=baseline,selected_sha256=sha(current)))
assert len({r['selected_sha256'] for r in repeats})==1
assert m.native.SRC.read_bytes()==source
(out/'summary.json').write_text(json.dumps(dict(repeats=repeats,production_fix=False,routing_benchmark=False),indent=2)+'\n')
print('PASS: sequential complete-board native revalidation; identical selected bytes 3/3')
print(json.dumps([(a['label'],a['accepted'],len(a['row']['errors']),a['row']['opens']) for a in repeats[0]['attempts']]))
