"""Reconstruct proposals and validate saved native identities and reports."""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p = argparse.ArgumentParser(); p.add_argument('--root', type=Path, required=True)
x = p.parse_args(); base = x.root/'connected'; reduced = x.root/'minimal'
z = json.loads((base/'summary.json').read_text())
q = json.loads((reduced/'summary.json').read_text())
original = (base/'input/board.kicad_pcb').read_bytes()
source = (base/'source/board.kicad_pcb').read_bytes()
inp, nodes = m.native.parse(original.decode()), m.native.parse(source.decode())
ids = {m.native.uid(n) for n in inp if isinstance(n, list)}
via = next(n for n in nodes if isinstance(n, list) and n[0] == 'via' and m.native.uid(n).startswith('d3812c01'))
copper = [n for n in nodes if isinstance(n, list) and n[0] in ('segment','via') and m.native.uid(n) not in ids and m.native.child(n,'net') == m.native.child(via,'net')]
assert copper == z['copper'] and len(copper) == 6
variants = dict(original=original, full=source, net=(m.native.dump(inp+copper)+'\n').encode())
variants['net-minus-via'] = (m.native.dump(inp+[n for n in copper if n != via])+'\n').encode()
def verify(data, name, root, row, failure):
    saved = root/name/'board.kicad_pcb'
    a, b = (m.transaction.identity.design_signature(v) for v in (data,saved.read_bytes()))
    report = json.loads((root/name/'drc.json').read_text())
    if failure:
        assert failure == 'checked board differs from proposed design' and a != b and row is None
    else:
        assert a == b and row['errors'] == [v for v in report['violations'] if v['severity'] == 'error']
        assert row['opens'] == len(report['unconnected_items'])
        assert row['groups'] == m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(saved)))
    for ext in ('.kicad_pro','.kicad_dru'):
        assert saved.with_suffix(ext).read_bytes() == (base/'source'/('board'+ext)).read_bytes() == (base/'input'/('board'+ext)).read_bytes()
for r in z['rows']:
    data = variants[r['label']]
    assert (base/(r['label']+'.kicad_pcb')).read_bytes() == data
    assert not r['failure']
    verify(data, f"{r['label']}-{r['repeat']}", base, r['row'], r['failure'])
    assert (len(r['row']['errors']),r['row']['opens']) == {'original':(0,110),'full':(6,15),'net':(1,108),'net-minus-via':(0,109)}[r['label']]
current = copper
for r in q['attempts']:
    proposal = [n for n in current if m.native.uid(n) != r['removed']]
    assert len(proposal) == len(current)-1
    data = (m.native.dump(inp+proposal)+'\n').encode()
    assert (reduced/(r['name']+'.kicad_pcb')).read_bytes() == data
    verify(data, r['name'], reduced, r['row'], r['failure'])
    baseline = next(r['row'] for r in z['rows'] if r['label']=='net')
    assert r['retained'] == (r['row'] is not None and m.transaction.errors(r['row']) == m.transaction.errors(baseline))
    if r['retained']: current = proposal
assert current == q['copper']
data = (m.native.dump(inp+current)+'\n').encode()
assert (reduced/'selected.kicad_pcb').read_bytes() == data
for i, row in enumerate(q['final']):
    verify(data, f'final-{i}', reduced, row, None)
    assert m.transaction.errors(row) == m.transaction.errors(baseline)
print('PASS: all proposals reconstructed; native designs, rules, errors, opens and partitions verified')
