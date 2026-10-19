"""Compare connected via displacement on a reduced witness and complete output."""
import argparse, hashlib, json, sys
from pathlib import Path
from geometry import relocate
sys.path.insert(0, str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
UID = 'd3812c01-5e0b-47fa-b2de-04d261bdf01e'
OFFSETS = [(0,0),(.5,0),(-.5,0),(0,.5),(0,-.5),(1,0),(-1,0),(0,1),(0,-1)]
p = argparse.ArgumentParser(); p.add_argument('--previous', type=Path, required=True); p.add_argument('--out', type=Path, required=True)
x = p.parse_args(); x.out.mkdir(parents=True, exist_ok=False)
assert m.native.pcbnew.Version() == '10.0.6'
m.native.SRC, m.native.D = x.previous/'connected/source/board.kicad_pcb', x.out
sources = [x.previous/'minimal/selected.kicad_pcb', m.native.SRC]
hashes = {str(v): hashlib.sha256(v.read_bytes()).hexdigest() for v in sources}
original_ids = {m.native.uid(n) for n in m.native.parse((x.previous/'connected/input/board.kicad_pcb').read_text()) if isinstance(n,list)}
rows = []
for label, path in zip(('reduced','full'), sources):
    nodes = m.native.parse(path.read_text())
    for repeat in range(3):
        baseline = None
        for index, (dx,dy) in enumerate(OFFSETS):
            name = f'{label}-{repeat}-{index}'
            data = (m.native.dump(relocate(nodes, UID, dx, dy, protected_ids=original_ids))+'\n').encode()
            (x.out/(name+'.kicad_pcb')).write_bytes(data)
            try:
                row = m.transaction.checked_native(data, name)
                failure = None
            except ValueError as exc:
                if str(exc) != 'checked board differs from proposed design': raise
                row, failure = None, str(exc)
            if index == 0:
                assert row is not None
                baseline = row
            lost = m.transaction.terminals.lost_pairs(baseline['groups'], row['groups']) if row else None
            accepted = bool(row and m.transaction.errors(row) < m.transaction.errors(baseline)
                and row['groups'].keys() == baseline['groups'].keys() and not lost and row['opens'] <= baseline['opens'])
            rows.append(dict(label=label, repeat=repeat, offset=[dx,dy], name=name,
                             row=row, failure=failure, lost_pairs=lost, accepted=accepted))
repeat_equal = {}
for label in ('reduced','full'):
    signatures = [json.dumps([{k:v for k,v in r.items() if k not in ('name','repeat','row')} |
        {'row': ({k:v for k,v in r['row'].items() if k not in ('name','errors')} | {'errors': sorted(r['row']['errors'],key=lambda e: json.dumps(e,sort_keys=True))}) if r['row'] else None}
        for r in rows if r['label']==label and r['repeat']==i], sort_keys=True) for i in range(3)]
    repeat_equal[label] = len(set(signatures)) == 1
assert hashes == {path: hashlib.sha256(Path(path).read_bytes()).hexdigest() for path in hashes}
(x.out/'summary.json').write_text(json.dumps(dict(rows=rows, hashes=hashes, exact_repeat_equal=repeat_equal, production_fix=False, routing_benchmark=False),indent=2)+'\n')
print('COMPLETE: 54 checks; source hashes unchanged; exact repeat equality:', repeat_equal)
