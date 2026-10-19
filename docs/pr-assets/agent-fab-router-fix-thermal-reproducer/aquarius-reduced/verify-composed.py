#!/usr/bin/python3
"""Independently replay retained sequential geometry, reports and terminal partitions."""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import native
import transaction
compose = transaction.module('compose', 'compose-generated.py')
HERE = Path(__file__).resolve().parent


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--results',type=Path,required=True)
    a=p.parse_args(); root=a.results
    s=json.loads((root/'summary.json').read_text())
    sha=lambda b:hashlib.sha256(b).hexdigest()
    original=compose.read(HERE/'rank8-target-results/source.kicad_pcb')
    assert sha(original)==s['source_sha256']
    assert [r['repeat'] for r in s['rows']]==[1,2,3]
    audits=0
    for r in s['rows']:
        current=original; prior=r['baseline']
        assert len(r['steps'])==2
        for step in r['steps']:
            assert sha(current)==step['before_sha256']
            witness_dir='full-generated-results' if step is r['steps'][0] else 'rank8-target-results'
            evidence=json.loads(compose.read(HERE/witness_dir/'summary.json'))
            witness=next(w for w in evidence['rows'] if w['accepted'])
            attempt=witness['attempts'][-1]
            info=witness['nearby'][attempt.get('track_rank',1)-1]
            assert step['pad_uuid']==witness['pad_uuid'] and step['track_uuid']==info['uuid']
            assert step['scale']==attempt['scale']
            current=next(data for scale,_,data in compose.generated.proposals(native.parse(current.decode()),info,witness['stored_gap_nm']) if scale==step['scale'])
            assert sha(current)==step['selected_sha256']
            assert transaction.errors(step['row']) < transaction.errors(prior)
            assert step['row']['groups'].keys()==prior['groups'].keys()
            assert not transaction.terminals.lost_pairs(prior['groups'],step['row']['groups'])
            assert step['row']['opens']<=prior['opens']
            prior=step['row']
        assert current==compose.read(root/f'selected-{r["repeat"]}.kicad_pcb')
        assert sha(current)==r['selected_sha256']
        rows=[r['baseline']]+[step['row'] for step in r['steps']]+[r['replay']]
        for row in rows:
            report=json.loads(compose.read(root/row['name']/'drc.json'))
            errors=[v for v in report['violations'] if v['severity']=='error']
            assert errors==row['errors'] and len(report['unconnected_items'])==row['opens']
            with tempfile.TemporaryDirectory() as tmp:
                board=Path(tmp)/'board.kicad_pcb';board.write_bytes(compose.read(root/row['name']/'board.kicad_pcb'))
                groups=transaction.terminals.partition(native.pcbnew.LoadBoard(str(board)))
                assert groups==row['groups']
            audits+=1
        assert transaction.errors(r['replay'])==transaction.errors(prior)
        assert r['replay']['groups']==prior['groups'] and r['replay']['opens']==prior['opens']
    print(f'PASS: {audits} reports/partitions and all sequential candidate bytes independently replayed')


if __name__=='__main__':main()
