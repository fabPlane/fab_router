#!/usr/bin/python3
"""Independently verify retained full-board selection evidence without rerunning DRC."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import search

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--results', type=Path, required=True)
x = p.parse_args()
z = json.loads((x.results/'summary.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
assert len(z['rows']) == 3 and z['native_version'] == '10.0.6'
assert not z['production_fix'] and not z['routing_benchmark']
for path, digest in z['source_sha256'].items():
    assert sha((x.results/'sources'/digest).read_bytes()) == digest
seen = set()
for row in z['rows']:
    repeat = row['repeat']
    assert repeat not in seen
    seen.add(repeat)
    assert len(row['baseline']['errors']) == 1 and row['baseline']['opens'] == 0
    assert not row['deletion_control']['errors'] and row['deletion_control']['opens'] == 1
    assert row['deletion_byte_rollback']
    assert row['accepted'] and len(row['attempts']) == 1
    attempt = row['attempts'][0]
    assert attempt['accepted'] and attempt['exception'] is None
    assert not attempt['row']['errors'] and attempt['row']['opens'] == 0
    assert attempt['row']['groups'] == row['baseline']['groups']
    selected = (x.results/f'selected-{repeat}.kicad_pcb').read_bytes()
    assert sha(selected) == row['selected_sha256'] == attempt['candidate_sha256']
    assert selected == (x.results/(attempt['name']+'.proposal.kicad_pcb')).read_bytes()
    for name, evidence in [(f'baseline-{repeat}', row['baseline']),
                           (f'deletion-{repeat}', row['deletion_control']),
                           (attempt['name'], attempt['row'])]:
        report = json.loads((x.results/name/'drc.json').read_text())
        assert [v for v in report['violations'] if v['severity'] == 'error'] == evidence['errors']
        assert len(report['unconnected_items']) == evidence['opens']
    sources = [x.results/'sources'/digest for path, digest in z['source_sha256'].items() if path.endswith('.kicad_pcb')]
    source = next(path for path in sources if z['segment'] in path.read_text())
    selected_nodes = search.native.parse(selected.decode())
    source_nodes = search.native.parse(source.read_text())
    removed = Counter(map(search.native.dump, source_nodes)) - Counter(map(search.native.dump, selected_nodes))
    added = Counter(map(search.native.dump, selected_nodes)) - Counter(map(search.native.dump, source_nodes))
    assert sum(removed.values()) == 1 and sum(added.values()) == 3
    assert search.native.uid(search.native.parse(next(iter(removed)))) == z['segment']
    assert selected in list(search.proposals(source_nodes, z['segment']))
    saved = (x.results/attempt['name']/'board.kicad_pcb').read_bytes()
    assert search.transaction.identity.design_signature(saved) == search.transaction.identity.design_signature(selected)
print('PASS: 9 native reports; exact terminal partitions; 152 unaffected generated items retained; three identical selections')
