"""Retain generated copper on the causal via net; never apply a repair."""
import argparse, json, sys, shutil, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m
p = argparse.ArgumentParser()
for key in ('source', 'input', 'out'):
    p.add_argument('--'+key, type=Path, required=True)
x = p.parse_args()
x.out.mkdir(parents=True, exist_ok=False)
m.native.SRC, m.native.D = x.source, x.out
assert m.native.pcbnew.Version() == '10.0.6'
source, original = x.source.read_bytes(), x.input.read_bytes()
nodes, inp = m.native.parse(source.decode()), m.native.parse(original.decode())
ids = {m.native.uid(n) for n in inp if isinstance(n, list)}
via = next(n for n in nodes if isinstance(n, list) and n[0] == 'via'
           and m.native.uid(n).startswith('d3812c01'))
net = m.native.child(via, 'net')
copper = [n for n in nodes if isinstance(n, list) and n[0] in ('segment', 'via')
          and m.native.uid(n) not in ids and m.native.child(n, 'net') == net]
assert via in copper
variants = {'original': original, 'full': source,
            'net': (m.native.dump(inp+copper)+'\n').encode(),
            'net-minus-via': (m.native.dump(inp+[n for n in copper if n is not via])+'\n').encode()}
hashes = {}
for label, path in [('source', x.source), ('input', x.input)]:
    (x.out/label).mkdir()
    for ext in ('.kicad_pcb', '.kicad_pro', '.kicad_dru'):
        data = path.with_suffix(ext).read_bytes()
        hashes[str(path.with_suffix(ext))] = hashlib.sha256(data).hexdigest()
        (x.out/label/('board'+ext)).write_bytes(data)
for ext in ('.kicad_pro', '.kicad_dru'):
    assert x.source.with_suffix(ext).read_bytes() == x.input.with_suffix(ext).read_bytes()
rows = []
for repeat in range(3):
    for label, data in variants.items():
        (x.out/(label+'.kicad_pcb')).write_bytes(data)
        try:
            row = m.transaction.checked_native(data, f'{label}-{repeat}')
            failure = None
        except ValueError as exc:
            if str(exc) != 'checked board differs from proposed design':
                raise
            row, failure = None, str(exc)
        rows.append(dict(label=label, repeat=repeat, row=row, failure=failure))
signatures = []
for repeat in range(3):
    selected = []
    for r in rows:
        if r['repeat'] != repeat: continue
        row = dict(r['row']) if r['row'] else None
        if row: row.pop('name')
        selected.append((r['label'], row, r['failure']))
    signatures.append(json.dumps(selected, sort_keys=True))
assert len(set(signatures)) == 1
assert hashes == {path: hashlib.sha256(Path(path).read_bytes()).hexdigest() for path in hashes}
(x.out/'summary.json').write_text(json.dumps(dict(rows=rows, copper=copper,
    source_hashes=hashes, production_fix=False, routing_benchmark=False), indent=2)+'\n')
print('PASS: four configurations repeated three times; sources unchanged')
