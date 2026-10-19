#!/usr/bin/python3
"""Diagnostic: native thermal metadata requires the matching project sidecar.

Does not route, resolve custom rules, choose spokes, or change production code.
The absent-project control deliberately demonstrates fallback, not safe import.
"""
import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

from metadata_identity import capture, validate

HERE = pathlib.Path(__file__).resolve().parent
PARENT = HERE.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(path):
    import pcbnew
    assert pcbnew.Version() == '10.0.6'
    identity = capture(path, pcbnew.Version())
    board = pcbnew.LoadBoard(str(path))
    pad, = [p for p in board.GetPads() if p.GetNetname() == 'GND']
    zone, = list(board.Zones())
    result = dict(input_identity=identity, board_sha256=identity['board'],
                project_present=identity['project'] is not None,
                project_sha256=identity['project'],
                board_min_resolved_spokes=board.GetDesignSettings().m_MinResolvedSpokes,
                zone_gap_nm=zone.GetThermalReliefGap(),
                zone_bridge_nm=zone.GetThermalReliefSpokeWidth(),
                pad_local_gap_nm=pad.GetLocalThermalGapOverride(),
                pad_local_bridge_nm=pad.GetLocalThermalSpokeWidthOverride(),
                zone_gap_with_pad_argument_nm=zone.GetThermalReliefGap(pad))
    # Validate after every native getter, so no mixed-input snapshot escapes.
    # This remains an observation check, not an atomic filesystem transaction.
    validate(identity, path, pcbnew.Version())
    return result


def invoke(argv, directory, name):
    with (directory / (name + '.log')).open('w') as log:
        subprocess.run(list(map(str, argv)), stdout=log, stderr=subprocess.STDOUT,
                       timeout=90, check=True)


def run(output):
    output.mkdir(parents=True, exist_ok=False)
    rows = []
    for repeat in range(1, 4):
        for label, minimum in (('project-two', 2), ('project-three', 3), ('missing-project', None)):
            directory = output / f'{repeat}-{label}'
            directory.mkdir()
            board = directory / 'before.kicad_pcb'
            shutil.copyfile(PARENT / 'route-input.kicad_pcb', board)
            shutil.copyfile(PARENT / 'thermal.kicad_dru', board.with_suffix('.kicad_dru'))
            if minimum is not None:
                project = json.loads((PARENT / 'thermal.kicad_pro').read_text())
                project['board']['design_settings']['rules']['min_resolved_spokes'] = minimum
                board.with_suffix('.kicad_pro').write_text(json.dumps(project, indent=2)+'\n')
            invoke([sys.executable, __file__, '--snapshot', board], directory, 'snapshot')
            data = json.loads(board.with_suffix('.metadata.json').read_text())
            assert data['board_sha256'] == digest(PARENT / 'route-input.kicad_pcb')
            assert data['board_min_resolved_spokes'] == (minimum or 2), data
            assert data['zone_gap_nm'] == data['zone_bridge_nm'] == 508000
            assert data['pad_local_gap_nm'] is data['pad_local_bridge_nm'] is None
            assert data['zone_gap_with_pad_argument_nm'] == 0, data
            report = directory / 'native.json'
            invoke(['kicad-cli', 'pcb', 'drc', '--severity-all', '--format', 'json',
                    '-o', report, board], directory, 'drc')
            native = json.loads(report.read_text())
            errors = [v for v in native['violations'] if v['severity'] == 'error']
            assert len(errors) == (1 if minimum == 3 else 0), errors
            if errors:
                assert errors[0]['type'] == 'starved_thermal'
                assert 'zone min spoke count 3; actual 2' in errors[0]['description']
            assert len(native['unconnected_items']) == 2
            rows.append(dict(repeat=repeat, variant=label, snapshot=data,
                             errors=errors, opens=2, native_sha256=digest(report)))
    result = dict(production_fix=False, routing_benchmark=False, repeats=3,
                  script_sha256=digest(pathlib.Path(__file__)), rows=rows)
    (output / 'summary.json').write_text(json.dumps(result, indent=2)+'\n')
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320">',
           '<rect width="1200" height="320" fill="#f4f6f8"/>']
    lines = ['Matching project metadata changes native thermal requirements',
             'Identical board bytes; three checks per variant; no routing performed',
             'Project minimum 2: API reads 2; native thermal errors 0',
             'Project minimum 3: API reads 3; native thermal errors 1 (actual spokes 2)',
             'Absent project: API falls back to 2; native thermal errors 0',
             'Zone gap = 508000 nm; pad-argument getter = 0; local override = absent',
             'Diagnostic only: custom rules, general resolution and production safety remain unresolved.']
    for i, line in enumerate(lines):
        svg.append(f'<text x="25" y="{38+i*42}" font-family="sans-serif" font-size="{24 if i==0 else 20}" fill="#152033">{line}</text>')
    (output / 'comparison.svg').write_text('\n'.join(svg+['</svg>'])+'\n')
    print('Verified nine native metadata controls; no routing benchmark or production fix.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--snapshot', type=pathlib.Path)
    group.add_argument('--out', type=pathlib.Path)
    args = parser.parse_args()
    if args.snapshot:
        path = args.snapshot.resolve()
        path.with_suffix('.metadata.json').write_text(json.dumps(snapshot(path), indent=2)+'\n')
    else:
        run(args.out.resolve())
