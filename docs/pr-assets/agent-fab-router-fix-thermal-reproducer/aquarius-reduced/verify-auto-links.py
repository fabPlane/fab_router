#!/usr/bin/python3
"""Replay bounded schedules against retained native designs, rules and reports.

Does not rerun DRC or authenticate reports. Uses the proposal generators and
search policy under test, with independent artifact/partition/append-only checks.
"""
import argparse
import json
from pathlib import Path
import native
import transaction
helper=transaction.module('replay_auto','auto-links.py')
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',required=True,type=Path)
p.add_argument('--results',required=True,type=Path)
a=p.parse_args()
summary=json.loads((a.results/'summary.json').read_text())
original=a.source.read_bytes()
for ext,digest in summary['input_sha256'].items():assert helper.sha(a.source.with_suffix(ext).read_bytes())==digest
count=0
for repeat,expected in enumerate(summary['rows'],1):
    native.D=a.results/f'repeat-{repeat}'
    expected_rows={'baseline':(expected['baseline'],None)}
    expected_rows.update({r['name']:(r['row'],r['exception']) for r in expected['attempts']})
    visited=[]
    def check(data,name):
        global count
        saved=(native.D/name/'board.kicad_pcb').read_bytes()
        report=json.loads((native.D/name/'drc.json').read_text())
        row,exception=expected_rows[name]
        drift=transaction.identity.design_signature(data)!=transaction.identity.design_signature(saved)
        drift|=any((native.D/name/('board'+ext)).read_bytes()!=a.source.with_suffix(ext).read_bytes()
                   for ext in ('.kicad_pro','.kicad_dru'))
        visited.append(name);count+=1
        if exception is not None:
            assert exception=='ValueError' and drift and row is None
            raise ValueError('retained native design drift')
        assert not drift
        assert row['errors']==[v for v in report['violations'] if v['severity']=='error']
        assert row['opens']==len(report['unconnected_items'])
        assert row['groups']==transaction.terminals.partition(native.pcbnew.LoadBoard(str(native.D/name/'board.kicad_pcb')))
        return row
    def proposals(data,row,target):
        nodes=native.parse(data.decode())
        for metadata,candidate in helper.native_proposals(data,row,target):
            changed=native.parse(candidate.decode())
            added=1 if metadata['kind']=='straight' else 2
            assert changed[:-added]==nodes
            assert all(n[0]=='segment' for n in changed[-added:])
            # Every new object has a distinct UUID, including across stages.
            existing={native.uid(n) for n in nodes if isinstance(n,list) and native.uid(n)}
            ids=[native.uid(n) for n in changed[-added:]]
            assert all(ids) and len(ids)==len(set(ids)) and not existing.intersection(ids)
            yield metadata,candidate
    selected,actual=helper.search(original,check,proposals,summary['budget'])
    assert json.loads(json.dumps(actual))==expected
    assert selected==(native.D/'selected.kicad_pcb').read_bytes()
    for ext in ('.kicad_pro','.kicad_dru'):assert (native.D/('selected'+ext)).read_bytes()==a.source.with_suffix(ext).read_bytes()
    assert len(visited)==len(expected_rows)==len(set(visited))
assert len({r['selected_sha256'] for r in summary['rows']})==1
print(f'PASS: {count} retained native checks; complete schedules, additive boundaries, design/rules, native reports, terminal partitions, selection and repeat stability')
