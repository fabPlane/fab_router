#!/usr/bin/python3
"""Fixture-specific spoke guard; original native settings/copper are preserved.

This supplies native metadata outside DSN and manually chooses one spoke.
It is neither a production fix nor a frozen benchmark or live adapter test.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE.parent))
from audit import invoke


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metadata(source, target):
    import pcbnew
    assert pcbnew.Version() == '10.0.6'
    board = pcbnew.LoadBoard(str(source))
    pad, = [p for p in board.GetPads() if p.GetNetname() == 'GND']
    zone, = list(board.Zones())
    assert zone.GetNetname() == pad.GetNetname()
    assert pad.GetLayer() == zone.GetLayer() == pcbnew.F_Cu
    assert pad.GetLocalThermalGapOverride() is None
    assert pad.GetLocalThermalSpokeWidthOverride() is None
    box = pad.GetBoundingBox()
    data = dict(net=pad.GetNetname(), layer='F.Cu',
                centre_x_nm=pad.GetPosition().x,
                pad_bottom_nm=box.GetY() + box.GetHeight(),
                thermal_gap_nm=zone.GetThermalReliefGap(),
                bridge_width_nm=zone.GetThermalReliefSpokeWidth(),
                min_thickness_nm=zone.GetMinThickness(),
                native_clearance_nm=zone.GetLocalClearance(),
                manual_direction='downward', fixture_specific=True)
    target.write_text(json.dumps(data, indent=2) + '\n')


def normalise_dsn(path):
    return path.read_text().replace('"' + str(path) + '"', '"design.dsn"')


def run(output):
    output.mkdir(parents=True, exist_ok=False)
    rows = []
    reference = None
    source_hashes = {str(p.relative_to(ROOT)): sha(p)
                     for folder in ('src', 'spec/types')
                     for p in sorted((ROOT / folder).rglob('*')) if p.is_file()}
    for repeat in range(1, 4):
        for mode in ('baseline', 'protected'):
            directory = output / f'{repeat}-{mode}'
            directory.mkdir()
            before, after = (directory / f'{n}.kicad_pcb' for n in ('before', 'after'))
            shutil.copyfile(HERE.parent / 'route-input.kicad_pcb', before)
            for board in (before, after):
                for ext in ('kicad_pro', 'kicad_dru'):
                    shutil.copyfile(HERE.parent / f'thermal.{ext}', board.with_suffix('.' + ext))
            invoke(['/usr/bin/python3', HERE.parent / 'audit.py', '--refill', before], directory, 'refill')
            invoke(['/usr/bin/python3', __file__, '--metadata', before, directory / 'metadata.json'], directory, 'metadata')
            dsn = normalise_dsn(before.with_suffix('.dsn'))
            if reference is None:
                reference = dsn
            assert reference == dsn, 'DSN input differs beyond filename'
            invoke(['bun', HERE / 'route.ts', before.with_suffix('.dsn'), directory / 'metadata.json',
                    mode, directory / 'route.ses', directory / 'engine.json'], directory, 'route')
            invoke(['/usr/bin/python3', HERE.parent / 'route-audit.py', '--import-session', before,
                    directory / 'route.ses', after], directory, 'import')
            # The only native structure changes allowed are generated tracks/vias
            # and refill polygons. Thermal settings, pads, zones and original copper
            # are preserved by the native importer (retained copper checked there).
            from audit import child, parse
            a, b = (parse(p.read_text()) for p in (before, after))
            for key in ('setup', 'footprint', 'gr_rect'):
                assert [n for n in a if isinstance(n, list) and n[0] == key] == [
                    n for n in b if isinstance(n, list) and n[0] == key], key
            def zone_settings(tree):
                zone = child(tree, 'zone')
                return [n for n in zone if not isinstance(n, list) or n[0] not in ('filled_polygon', 'fill_segments')]
            assert zone_settings(a) == zone_settings(b)
            native = {}
            for name, board in (('before', before), ('after', after)):
                report = directory / f'{name}.json'
                invoke(['kicad-cli', 'pcb', 'drc', '--severity-all', '--format', 'json', '-o', report, board], directory, name + '-drc')
                drc = json.loads(report.read_text())
                errors = dict(collections.Counter(v['type'] for v in drc['violations'] if v['severity'] == 'error'))
                expected = {'starved_thermal': 1} if name == 'after' and mode == 'baseline' else {}
                assert errors == expected, (repeat, mode, name, errors)
                assert len(drc['unconnected_items']) == (2 if name == 'before' else 1)
                if name == 'after':
                    descriptions = [item['description'] for item in drc['unconnected_items'][0]['items']]
                    assert all('[Net-(LO(Q)1-Pad1)]' in text for text in descriptions)
                    assert any(text.startswith('Track [Net-(LO(Q)1-Pad1)]') for text in descriptions)
                native[name] = dict(errors=errors, opens=len(drc['unconnected_items']), report_sha256=sha(report))
            rows.append(dict(repeat=repeat, mode=mode, native=native,
                             normalised_dsn_sha256=hashlib.sha256(dsn.encode()).hexdigest(),
                             engine=json.loads((directory / 'engine.json').read_text())))
    assert source_hashes == {name: sha(ROOT / name) for name in source_hashes}
    result = dict(repeats=3, production_fix=False, benchmark_score=False,
                  native_version='10.0.6', cores='20-25', seed=1,
                  note='Manual downward-spoke selection on one miniature only. No native setting changes. '
                       'One unrelated native open remains; general spoke selection and routing safety unresolved.',
                  source_commit=subprocess.check_output(['git', '-C', ROOT, 'rev-parse', 'HEAD'], text=True).strip(),
                  source_hashes=source_hashes, input_sha256=sha(HERE.parent / 'route-input.kicad_pcb'), rows=rows)
    (output / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps([{k: r[k] for k in ('repeat', 'mode', 'native')} for r in rows], indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=pathlib.Path)
    parser.add_argument('--metadata', nargs=2, type=pathlib.Path)
    args = parser.parse_args()
    if args.metadata:
        metadata(*args.metadata)
    elif args.out:
        run(args.out.resolve())
    else:
        parser.error('--out or --metadata required')
