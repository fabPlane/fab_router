#!/usr/bin/python3
"""Characterise a known native failure, not an acceptance pass or router fix.

Requires stock KiCad 10.0.6 pcbnew/kicad-cli, Bun, and an unused output directory.
Uses a fresh process per refill to avoid pcbnew object lifetime interactions.
"""
import argparse, collections, hashlib, json, pathlib, re, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent

def parse(text):
    stack = []
    root = None
    for token in re.findall(r'"(?:\\.|[^"\\])*"|[()]|[^\s()]+', text):
        if token == '(':
            node = []
            if stack:
                stack[-1].append(node)
            stack.append(node)
        elif token == ')':
            root = stack.pop()
        else:
            stack[-1].append(token)
    assert not stack and root is not None
    return root

def dump(node):
    return '(' + ' '.join(map(dump, node)) + ')' if isinstance(node, list) else node

def child(node, key):
    return next((x for x in node if isinstance(x, list) and x[0] == key), None)

def invoke(argv, directory, name):
    with (directory / (name + '.log')).open('w') as log:
        subprocess.run(list(map(str, argv)), stdout=log, stderr=subprocess.STDOUT, check=True, timeout=90)

def refill(path):
    import pcbnew
    assert pcbnew.Version() == '10.0.6', pcbnew.Version()
    board = pcbnew.LoadBoard(str(path))
    board.BuildConnectivity()
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())
    pcbnew.SaveBoard(str(path), board)
    if not pcbnew.ExportSpecctraDSN(board, str(path.with_suffix('.dsn'))):
        raise RuntimeError('DSN export failed')

def main(output):
    output.mkdir(parents=True, exist_ok=False)
    tree = parse((HERE / 'thermal.kicad_pcb').read_text())
    copper = [n for n in tree if isinstance(n, list) and n[0] in ('segment', 'via')]
    assert len(copper) == 3
    rows = []
    # Every single obstacle is necessary in this fixture. Keep all geometry and
    # rules identical except the named removed obstacle in each diagnostic control.
    variants = [('all-copper', None)] + [(f'without-{i}-{n[0]}', n) for i, n in enumerate(copper)]
    for variant, removed in variants:
        for repeat in range(1, 4):
            directory = output / f'{variant}-{repeat}'
            directory.mkdir()
            board = directory / 'board.kicad_pcb'
            board.write_text(dump([n for n in tree if n is not removed]) + '\n')
            for ext in ('kicad_pro', 'kicad_dru'):
                shutil.copyfile(HERE / f'thermal.{ext}', board.with_suffix('.' + ext))
            invoke([sys.executable, __file__, '--refill', board], directory, 'refill')
            report = directory / 'drc.json'
            invoke(['kicad-cli', 'pcb', 'drc', '--severity-all', '--format', 'json', '-o', report, board], directory, 'drc')
            drc = json.loads(report.read_text())
            types = collections.Counter(v['type'] for v in drc['violations'])
            thermals = [v for v in drc['violations'] if v['type'] == 'starved_thermal']
            assert len(thermals) == (1 if removed is None else 0), (variant, types)
            if thermals:
                assert 'zone min spoke count 2; actual 1' in thermals[0]['description']
                assert thermals[0]['severity'] == 'error'
            assert not any('clearance' in t or t == 'shorting_items' for t in types), types
            if removed is None:
                invoke(['bun', HERE / 'check-engine.ts', board.with_suffix('.dsn')], directory, 'engine')
            rows.append(dict(variant=variant, repeat=repeat, native_types=dict(types),
                             native_unconnected=len(drc['unconnected_items']),
                             board_sha256=hashlib.sha256(board.read_bytes()).hexdigest()))
    result = dict(native_version='10.0.6', repeats=3, rows=rows,
                  fixed=False, benchmark_score=False,
                  note='Dangling copper and opens are retained in native reports; diagnostic controls are not routed-board passes.')
    (output / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=pathlib.Path)
    parser.add_argument('--refill', type=pathlib.Path)
    args = parser.parse_args()
    if args.refill:
        refill(args.refill)
    elif args.out:
        main(args.out.resolve())
    else:
        parser.error('--out or --refill required')
