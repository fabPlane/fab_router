#!/usr/bin/python3
"""Replay retained native outputs through the live diagnostic check boundary.

No fresh native calls: each output/report is a retained real native check.
The expected mismatches are existing short-induced net reassignment, not mocks
of scalar DRC scores. Three repeats are present in the retained evidence.
"""
import argparse
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import native
import transaction

verify = transaction.module('checked_verify', 'verify-composed.py')
generated = transaction.module('checked_generated', 'generated-transaction.py')
HERE = Path(__file__).resolve().parent
read = verify.compose.read


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--reference', action='store_true', help='Replay the previous unguarded native callback; expected to fail')
    args = parser.parse_args()
    def unguarded(data, name):
        row = native.check(native.parse(data.decode()), name)
        row['groups'] = transaction.terminals.partition(native.pcbnew.LoadBoard(
            str(native.D/name/'board.kicad_pcb')))
        return row
    check = unguarded if args.reference else transaction.checked_native
    root = HERE/'remaining-composed-results'
    summary = json.loads(read(root/'summary.json'))
    source = read(root/'source.kicad_pcb')
    nodes = native.parse(source.decode())
    cases = {}
    for row in summary['rows']:
        cases[row['baseline']['name']] = (source, row['baseline'])
        proposals = generated.ranked_proposals(nodes, row['nearby'], row['stored_gap_nm'])
        for attempt, (_, _, _, candidate) in zip(row['attempts'], proposals, strict=False):
            cases[attempt['name']] = (candidate, attempt['row'])
    assert len(cases) == 243
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        native.D = Path(tmp)
        native.SRC = native.D/'source.kicad_pcb'
        for ext in ('.kicad_pro', '.kicad_dru'):
            native.SRC.with_suffix(ext).write_bytes(read(root/('source'+ext)))
        for name, (candidate, retained) in cases.items():
            checked = read(root/name/'board.kicad_pcb')
            drift = verify.design_signature(checked) != verify.design_signature(candidate)
            def replay(actual_nodes, actual_name):
                assert actual_name == name and actual_nodes == native.parse(candidate.decode())
                folder = native.D/name
                folder.mkdir()
                (folder/'board.kicad_pcb').write_bytes(checked)
                for ext in ('.kicad_pro', '.kicad_dru'):
                    (folder/('board'+ext)).write_bytes(read(root/name/('board'+ext)))
                return dict(retained)
            rejected = False
            with patch.object(native, 'check', replay):
                try:
                    actual = check(candidate, name)
                    assert actual['groups'] == retained['groups']
                except ValueError as exc:
                    assert str(exc) == 'checked board differs from proposed design'
                    rejected = True
            results.append(dict(name=name, design_drift=drift, rejected=rejected,
                                correct=rejected == drift))
    args.out.mkdir(parents=True, exist_ok=False)
    report = dict(production_fix=False, routing_benchmark=False, native_rerun=False,
                  checks=len(results), correct=sum(r['correct'] for r in results),
                  drift=sum(r['design_drift'] for r in results), rows=results)
    (args.out/'summary.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'{report["correct"]}/{report["checks"]} correct; {report["drift"]} real native design mismatches')
    assert all(r['correct'] for r in results), 'native design drift reached the transaction acceptance boundary'


if __name__ == '__main__':
    main()
