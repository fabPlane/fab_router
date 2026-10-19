#!/usr/bin/python3
"""Observe custom-rule fill widths independently of stored zone getters.

Diagnostic only: finite cross sections do not resolve effective rules or prove
spoke connectivity. No routing or production guard is installed.
"""
import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(path):
    import pcbnew
    assert pcbnew.Version() == '10.0.6'
    board = pcbnew.LoadBoard(str(path))
    pad, = [p for p in board.GetPads() if p.GetNetname() == 'GND']
    zone, = list(board.Zones())
    poly = zone.GetFilledPolysList(board.GetLayerID('F.Cu'))
    box = pad.GetBoundingBox()
    sections = {}
    for direction in ('down', 'left'):
        samples = []
        for offset in range(-600000, 600001, 1000):
            x, y = ((pad.GetPosition().x + offset, box.GetBottom() + 254000)
                    if direction == 'down' else
                    (box.GetLeft() - 254000, pad.GetPosition().y + offset))
            if poly.Contains(pcbnew.VECTOR2I(x, y)):
                samples.append(offset)
        sections[direction] = dict(count=len(samples), first_nm=min(samples) if samples else None,
                                   last_nm=max(samples) if samples else None)
    return dict(zone_width_nm=zone.GetThermalReliefSpokeWidth(),
                local_width_nm=pad.GetLocalThermalSpokeWidthOverride(),
                zone_gap_nm=zone.GetThermalReliefGap(),
                pad_argument_gap_nm=zone.GetThermalReliefGap(pad), sections=sections)


def run(out):
    out.mkdir(parents=True, exist_ok=False)
    rows = []
    source = HERE.parent / 'route-input.kicad_pcb'
    original = digest(source)
    for repeat in range(1, 4):
        for label, width in (('zone-default', None), ('custom-400', '0.4'), ('custom-200', '0.2')):
            directory = out / f'{repeat}-{label}'
            directory.mkdir()
            board = directory / 'board.kicad_pcb'
            shutil.copyfile(source, board)
            shutil.copyfile(HERE.parent / 'thermal.kicad_pro', board.with_suffix('.kicad_pro'))
            rule = '(version 1)\n'
            if width:
                rule += (f'(rule "fixture bridge" (condition "A.NetName == \'GND\'") '
                         f'(constraint thermal_spoke_width (min {width}mm) '
                         f'(opt {width}mm) (max {width}mm)))\n')
            board.with_suffix('.kicad_dru').write_text(rule)
            assert digest(board) == original
            report = directory / 'drc.json'
            commands = [
                ['kicad-cli', 'pcb', 'drc', '--refill-zones', '--save-board', '--severity-all',
                 '--format', 'json', '-o', str(report), str(board)],
                [sys.executable, str(pathlib.Path(__file__)), '--snapshot', str(board)],
            ]
            for index, command in enumerate(commands):
                with (directory / f'{index}.log').open('w') as log:
                    subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=90)
            data = json.loads(board.with_suffix('.snapshot.json').read_text())
            native = json.loads(report.read_text())
            errors = [v for v in native['violations'] if v['severity'] == 'error']
            assert not errors, errors
            assert data['zone_width_nm'] == data['zone_gap_nm'] == 508000
            assert data['local_width_nm'] is None and data['pad_argument_gap_nm'] == 0
            expected = {'zone-default': 508, 'custom-400': 400, 'custom-200': 0}[label]
            assert all(section['count'] == expected for section in data['sections'].values())
            rows.append(dict(repeat=repeat, variant=label, input_sha256=original,
                             rules_sha256=digest(board.with_suffix('.kicad_dru')),
                             filled_sha256=digest(board), errors=len(errors),
                             warnings=[v['type'] for v in native['violations'] if v['severity'] == 'warning'],
                             opens=len(native['unconnected_items']), snapshot=data))
    assert digest(source) == original
    for label in ('zone-default', 'custom-400', 'custom-200'):
        selected = [r for r in rows if r['variant'] == label]
        assert all(r['snapshot'] == selected[0]['snapshot'] for r in selected)
    assert len({json.dumps(r['snapshot']['sections'], sort_keys=True) for r in rows}) == 3
    (out / 'summary.json').write_text(json.dumps(dict(production_fix=False, routing_benchmark=False,
        script_sha256=digest(pathlib.Path(__file__)),
        step_nm=1000, section_distance_nm=254000, repeats=3, rows=rows), indent=2)+'\n')
    print('Verified three distinct native cross sections despite identical stored getters, three repeats each.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--snapshot', type=pathlib.Path)
    group.add_argument('--out', type=pathlib.Path)
    args = parser.parse_args()
    if args.snapshot:
        args.snapshot.with_suffix('.snapshot.json').write_text(json.dumps(snapshot(args.snapshot), indent=2)+'\n')
    else:
        run(args.out.resolve())
