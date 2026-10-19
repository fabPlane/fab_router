#!/usr/bin/python3
"""Inventory an aborted static search without accepting or normalising its decisions."""
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1])
here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('terminals', here / 'terminal-partitions.py')
terminals = importlib.util.module_from_spec(spec)
spec.loader.exec_module(terminals)
pad = sys.argv[2]
sha = lambda f: hashlib.sha256(f.read_bytes()).hexdigest()
rows = []
base = terminals.partition(terminals.pcbnew.LoadBoard(str(root / 'baseline-1/board.kicad_pcb')))
for directory in sorted(f for f in root.iterdir() if f.is_dir()):
    report = json.loads((directory / 'drc.json').read_text())
    groups = terminals.partition(terminals.pcbnew.LoadBoard(str(directory / 'board.kicad_pcb')))
    errors = [v for v in report['violations'] if v['severity'] == 'error']
    target = [v for v in errors if v['type'] == 'starved_thermal'
              and any(item['uuid'] == pad for item in v['items'])]
    assert groups == base
    rows.append(dict(name=directory.name, errors=errors, opens=len(report['unconnected_items']),
                     target=target, exact_partition=True,
                     sha256={f.name: sha(f) for f in directory.iterdir() if f.is_file() and f.suffix != '.kicad_prl'}))
assert len(rows) == 51
mismatches = []
for row in rows:
    if not row['name'].endswith('-1'):
        continue
    repeats = [r for r in rows if r['name'][:-1] == row['name'][:-1]]
    assert len(repeats) == 3
    assert all(r['opens'] == row['opens'] and r['target'] == row['target'] for r in repeats)
    multiset = lambda r: Counter(json.dumps(e, sort_keys=True) for e in r['errors'])
    assert all(multiset(r) == multiset(row) for r in repeats)
    if any(r['errors'] != row['errors'] for r in repeats):
        mismatches.append(row['name'][:-2])
summary = dict(production_fix=False, routing_benchmark=False, selection_accepted=False,
               pad_uuid=pad, checks=51, terminals=len(base),
               components=len({tuple(group) for group in base.values()}),
               exact_error_order_mismatches=mismatches, rows=rows)
(root / 'audit.json').write_text(json.dumps(summary, indent=2)+'\n')
first = [r for r in rows if r['name'].endswith('-1')]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1280"><rect width="1100" height="1280" fill="white"/><g font-family="sans-serif" fill="#182838"><text x="30" y="40" font-size="25">R20 pad: rejected eight-track thermal search</text><text x="30" y="75" font-size="18">51 native refills; three repeats each; no candidate removes target error</text>']
for i, row in enumerate(first):
    y = 100+i*62
    svg.append(f'<text x="30" y="{y+25}" font-size="17">{row["name"][:-2]}</text><rect x="280" y="{y}" width="{len(row["errors"])*60}" height="35" fill="#697686"/><text x="{295+len(row["errors"])*60}" y="{y+25}" font-size="17">{len(row["errors"])} errors; {row["opens"]} opens</text>')
svg.append('<text x="30" y="1190" font-size="18">All terminal partitions preserved. One candidate fails exact error ordering across repeats.</text><text x="30" y="1225" font-size="18">No selection accepted; no production repair or routing benchmark gain.</text></g></svg>')
(root / 'comparison.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(root / 'comparison.svg'), '-o', str(root / 'comparison.png')], check=True)
print(json.dumps({k:v for k,v in summary.items() if k != 'rows'}, indent=2))
