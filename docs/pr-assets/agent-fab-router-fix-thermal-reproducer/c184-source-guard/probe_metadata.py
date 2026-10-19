"""Native adversarial control: a clean copper candidate also renames a source footprint."""
import argparse, json, sys
from pathlib import Path
assets=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(assets/'aquarius-reduced'))
import transaction as t
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);x=p.parse_args()
source=x.root/'before/source/board.kicad_pcb';out=x.root/'metadata-control';out.mkdir(exist_ok=False)
t.native.SRC=source;t.native.D=out
old=dict(__file__=str(assets/'aquarius-reduced/transaction.py'))
exec(compile((Path(__file__).with_name('transaction-before.py')).read_text(),old['__file__'],'exec'),old)
original=source.read_bytes();clean=(x.root/'before/composed/selected-0.kicad_pcb').read_bytes()
nodes=t.native.parse(clean.decode())
property_node=next(c for n in nodes if isinstance(n,list) and n[0]=='footprint' for c in n if isinstance(c,list) and c[:2]==['property','"Reference"'])
before=property_node[2];property_node[2]='"SOURCE_GUARD_PROBE"'
candidate=(t.native.dump(nodes)+'\n').encode();(out/'candidate.kicad_pcb').write_bytes(candidate)
baseline=json.loads((x.root/'before/composed/summary.json').read_text())['repeats'][0]['baseline']
rows=[]
for repeat in range(3):
    selected,accepted,row,exception=t.transact(original,candidate,baseline,lambda data:old['checked_native'](data,f'old-{repeat}'))
    assert accepted and selected==candidate and not row['errors'] and row['opens']==14 and exception is None
    restored,guarded,newrow,error=t.transact(original,candidate,baseline,lambda data:t.checked_native(data,f'guarded-{repeat}'))
    assert restored==original and not guarded and newrow is None and error=='ValueError'
    assert not (out/f'guarded-{repeat}').exists()
    rows.append(dict(repeat=repeat,old_accepted=accepted,row=row,new_accepted=guarded,new_exception=error,exact_rollback=restored==original))
assert source.read_bytes()==original
(out/'summary.json').write_text(json.dumps(dict(reference_before=before,reference_after=property_node[2],rows=rows,production_fix=False),indent=2)+'\n')
print('PASS: old validator publishes unauthorized reference edit 3/3; source guard rejects before native execution and restores exact source 3/3')
