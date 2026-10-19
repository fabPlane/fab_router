"""Greedy deletion diagnostic with native identity validation, not route repair."""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p = argparse.ArgumentParser()
p.add_argument('--results', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
x = p.parse_args()
x.out.mkdir(parents=True, exist_ok=False)
z = json.loads((x.results/'summary.json').read_text())
m.native.SRC, m.native.D = x.results/'source/board.kicad_pcb', x.out
inp = m.native.parse((x.results/'input/board.kicad_pcb').read_text())
current = z['copper']
baseline = next(r['row'] for r in z['rows'] if r['label'] == 'net')
assert len(baseline['errors']) == 1 and baseline['errors'][0]['type'] == 'starved_thermal'
attempts = []
for node in list(current):
    proposal = [n for n in current if n is not node]
    data = (m.native.dump(inp+proposal)+'\n').encode()
    name = f'delete-{len(attempts)}'
    (x.out/(name+'.kicad_pcb')).write_bytes(data)
    try:
        row = m.transaction.checked_native(data, name)
        failure = None
    except ValueError as exc:
        if str(exc) != 'checked board differs from proposed design': raise
        row, failure = None, str(exc)
    retained = row is not None and m.transaction.errors(row) == m.transaction.errors(baseline)
    attempts.append(dict(name=name, removed=m.native.uid(node), row=row,
                         failure=failure, retained=retained))
    if retained: current = proposal
data = (m.native.dump(inp+current)+'\n').encode()
(x.out/'selected.kicad_pcb').write_bytes(data)
final = [m.transaction.checked_native(data, f'final-{i}') for i in range(3)]
assert all(m.transaction.errors(r) == m.transaction.errors(baseline) for r in final)
assert len({json.dumps({k:v for k,v in r.items() if k != 'name'}, sort_keys=True) for r in final}) == 1
assert {m.native.uid(n) for n in current} == {
    'd3812c01-5e0b-47fa-b2de-04d261bdf01e',
    '1adf0f37-dc56-4f22-b0f7-e01166fcee29'}
assert all(len(r['errors']) == 1 and r['opens'] == 110 for r in final)
(x.out/'summary.json').write_text(json.dumps(dict(attempts=attempts, final=final,
    copper=current, production_fix=False, globally_minimal=False), indent=2)+'\n')
print('PASS: identity-preserving greedy witness:', len(current), 'items; 3 final checks')
