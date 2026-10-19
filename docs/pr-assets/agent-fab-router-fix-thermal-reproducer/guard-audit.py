#!/usr/bin/python3
"""Characterise native validation ordering and whole-board restoration.

This disposable-file prototype is not an adapter implementation. It preserves
all findings and never changes thermal settings or removes selected copper.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import shutil
import sys
from audit import HERE, invoke


def import_stale(source, session, target):
    import pcbnew
    assert pcbnew.Version() == '10.0.6'
    board = pcbnew.LoadBoard(str(source))
    def copper():
        return collections.Counter((t.GetClass(), t.GetStart().x, t.GetStart().y,
                                    t.GetEnd().x, t.GetEnd().y, t.GetWidth(),
                                    t.GetLayer(), t.GetNetname()) for t in board.GetTracks())
    retained = copper()
    assert pcbnew.ImportSpecctraSES(board, str(session))
    assert not (retained - copper()), 'native import lost retained copper'
    board.BuildConnectivity()
    # Deliberately retain the original fill to measure pre-refill DRC.
    pcbnew.SaveBoard(str(target), board)


def findings(board, directory, name):
    report = directory / (name + '.json')
    invoke(['kicad-cli', 'pcb', 'drc', '--severity-all', '--format', 'json',
            '-o', report, board], directory, name + '-drc')
    data = json.loads(report.read_text())
    return dict(errors=dict(collections.Counter(
        v['type'] for v in data['violations'] if v['severity'] == 'error')),
        unconnected=len(data['unconnected_items']),
        warnings=dict(collections.Counter(
        v['type'] for v in data['violations'] if v['severity'] == 'warning')))


def run(output):
    output.mkdir(parents=True, exist_ok=False)
    rows = []
    for repeat in range(1, 4):
        directory = output / str(repeat)
        directory.mkdir()
        boards = {name: directory / (name + '.kicad_pcb')
                  for name in ('before', 'stale', 'refilled', 'restored')}
        shutil.copyfile(HERE / 'route-input.kicad_pcb', boards['before'])
        for board in boards.values():
            for ext in ('kicad_pro', 'kicad_dru'):
                shutil.copyfile(HERE / ('thermal.' + ext), board.with_suffix('.' + ext))
        invoke([sys.executable, HERE / 'audit.py', '--refill', boards['before']], directory, 'prepare')
        original = boards['before'].read_bytes()
        invoke(['bun', HERE / 'route-input.ts', boards['before'].with_suffix('.dsn'),
                directory / 'route.ses', directory / 'engine.json'], directory, 'route')
        invoke([sys.executable, __file__, '--import-stale', boards['before'],
                directory / 'route.ses', boards['stale']], directory, 'import')
        shutil.copyfile(boards['stale'], boards['refilled'])
        invoke([sys.executable, HERE / 'audit.py', '--refill', boards['refilled']], directory, 'refill')
        # Model rejection by restoring the full saved board, not partial deletion.
        boards['restored'].write_bytes(original)
        assert boards['restored'].read_bytes() == original
        states = {name: findings(board, directory, name) for name, board in boards.items()}
        assert states['stale']['errors'] == {'clearance': 4, 'hole_clearance': 2}, states
        assert states['before']['errors'] == {}
        assert states['refilled']['errors'] == {'starved_thermal': 1}
        assert states['restored'] == states['before'], states
        rows.append(dict(repeat=repeat, states=states,
                         original_sha256=hashlib.sha256(original).hexdigest(),
                         restored_sha256=hashlib.sha256(boards['restored'].read_bytes()).hexdigest(),
                         engine=json.loads((directory / 'engine.json').read_text())))
    result = dict(fixed=False, benchmark_score=False, repeats=3, rows=rows,
                  source_sha256={str(p.relative_to(HERE)): hashlib.sha256(p.read_bytes()).hexdigest()
                                 for p in (pathlib.Path(__file__), HERE / 'audit.py', HERE / 'route-input.ts',
                                           HERE / 'route-input.kicad_pcb', HERE / 'thermal.kicad_pro', HERE / 'thermal.kicad_dru')})
    (output / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=pathlib.Path)
    parser.add_argument('--import-stale', nargs=3, type=pathlib.Path)
    args = parser.parse_args()
    if args.import_stale:
        import_stale(*args.import_stale)
    elif args.out:
        run(args.out.resolve())
    else:
        parser.error('--out or --import-stale required')
