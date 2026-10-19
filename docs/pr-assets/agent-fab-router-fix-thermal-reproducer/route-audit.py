#!/usr/bin/python3
"""Route a thermal-clean input; assert the known native thermal failure (unfixed).

--expect-safe instead expects zero thermal errors and currently fails, providing
an explicit future acceptance target. Neither mode changes native rules.
"""
import argparse, collections, json, pathlib, shutil, sys
from audit import HERE, invoke, refill

def import_session(source, session, target):
    import pcbnew
    assert pcbnew.Version() == '10.0.6'
    board = pcbnew.LoadBoard(str(source))
    def copper():
        return collections.Counter((t.GetClass(), t.GetStart().x, t.GetStart().y,
                                    t.GetEnd().x, t.GetEnd().y, t.GetWidth(),
                                    t.GetLayer(), t.GetNetname()) for t in board.GetTracks())
    retained = copper()
    assert pcbnew.ImportSpecctraSES(board, str(session)), 'native SES import failed'
    assert not (retained - copper()), 'native import lost retained copper'
    board.BuildConnectivity()
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())
    pcbnew.SaveBoard(str(target), board)

def run(output, expect_safe):
    output.mkdir(parents=True, exist_ok=False)
    rows = []
    for repeat in range(1, 4):
        directory = output / str(repeat)
        directory.mkdir()
        before, after = [directory / (name + '.kicad_pcb') for name in ('before', 'after')]
        shutil.copyfile(HERE / 'route-input.kicad_pcb', before)
        for board in (before, after):
            for ext in ('kicad_pro', 'kicad_dru'):
                shutil.copyfile(HERE / ('thermal.' + ext), board.with_suffix('.' + ext))
        invoke([sys.executable, HERE / 'audit.py', '--refill', before], directory, 'refill')
        invoke(['bun', HERE / 'route-input.ts', before.with_suffix('.dsn'), directory / 'route.ses', directory / 'engine.json'], directory, 'route')
        invoke([sys.executable, __file__, '--import-session', before, directory / 'route.ses', after], directory, 'import')
        conditions = {}
        for name, board in (('before', before), ('after', after)):
            report = directory / (name + '.json')
            invoke(['kicad-cli', 'pcb', 'drc', '--severity-all', '--format', 'json', '-o', report, board], directory, name + '-drc')
            drc = json.loads(report.read_text())
            types = collections.Counter(v['type'] for v in drc['violations'])
            errors = collections.Counter(v['type'] for v in drc['violations'] if v['severity'] == 'error')
            assert not any('clearance' in t or t == 'shorting_items' for t in types), types
            assert not errors if name == 'before' else set(errors) <= {'starved_thermal'}, (name, errors)
            conditions[name] = dict(types=dict(types), errors=dict(errors), unconnected=len(drc['unconnected_items']))
        engine = json.loads((directory / 'engine.json').read_text())
        rows.append(dict(repeat=repeat, native=conditions, engine=engine))
    result = dict(repeats=3, fixed=False, benchmark_score=False, rows=rows)
    (output / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    expected = {} if expect_safe else {'starved_thermal': 1}
    assert all(r['native']['after']['errors'] == expected for r in rows), 'UNFIXED: routing adds native thermal errors'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=pathlib.Path)
    parser.add_argument('--expect-safe', action='store_true')
    parser.add_argument('--import-session', nargs=3, type=pathlib.Path)
    args = parser.parse_args()
    if args.import_session:
        import_session(*args.import_session)
    elif args.out:
        run(args.out.resolve(), args.expect_safe)
    else:
        parser.error('--out or --import-session required')
