#!/usr/bin/python3
"""Exercise exact rollback on real retained native design drift and sidecar drift."""
import argparse
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import native
import transaction

compose = transaction.module('boundary_compose', 'verify-composed.py')
read = compose.compose.read
HERE = Path(__file__).resolve().parent


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    root = HERE/'remaining-composed-results'
    summary = json.loads(read(root/'summary.json'))
    generated = compose.compose.generated
    original = read(root/'source.kicad_pcb')
    cases = []
    for row in summary['rows']:
        proposals = generated.ranked_proposals(native.parse(original.decode()), row['nearby'], row['stored_gap_nm'])
        for attempt, (_, _, _, candidate) in zip(row['attempts'], proposals, strict=False):
            checked = read(root/attempt['name']/'board.kicad_pcb')
            if compose.design_signature(candidate) != compose.design_signature(checked):
                cases.append((attempt['name'], candidate, checked, row['baseline'], attempt['row'], None))
    assert len(cases) == 9
    baseline = summary['rows'][0]['baseline']
    for repeat in range(1, 4):
        for ext in ('.kicad_pro', '.kicad_dru'):
            cases.append((f'sidecar-{repeat}-{ext[1:]}', original,
                          read(root/baseline['name']/'board.kicad_pcb'), baseline, baseline, ext))
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        native.D, native.SRC = Path(tmp), Path(tmp)/'source.kicad_pcb'
        for ext in ('.kicad_pro', '.kicad_dru'):
            native.SRC.with_suffix(ext).write_bytes(read(root/('source'+ext)))
        for name, candidate, checked, baseline, retained, changed in cases:
            def replay(nodes, actual_name):
                assert nodes == native.parse(candidate.decode()) and actual_name == name
                folder = native.D/name
                folder.mkdir()
                (folder/'board.kicad_pcb').write_bytes(checked)
                for ext in ('.kicad_pro', '.kicad_dru'):
                    value = native.SRC.with_suffix(ext).read_bytes()
                    (folder/('board'+ext)).write_bytes(value + (b'\n' if ext == changed else b''))
                return dict(retained)
            with patch.object(native, 'check', replay):
                output, accepted, row, exception = transaction.transact(original, candidate, baseline,
                    lambda data: transaction.checked_native(data, name))
            assert output == original and not accepted and row is None and exception == 'ValueError', name
            results.append(dict(name=name, byte_rollback=True, exception=exception))
    a.out.mkdir(parents=True, exist_ok=False)
    (a.out/'summary.json').write_text(json.dumps(results, indent=2)+'\n')
    print('PASS: nine real native design drifts and six rule-sidecar changes reject with exact byte rollback')


if __name__ == '__main__':
    main()
