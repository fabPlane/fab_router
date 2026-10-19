#!/usr/bin/python3
"""Native four-direction diagnostic on the same rectangular-pad miniature."""
import argparse
import collections
import json
import pathlib
import shutil
import subprocess
import sys
HERE = pathlib.Path(__file__).resolve().parent
import importlib.util
sys.path.insert(0, str(HERE.parent))
spec = importlib.util.spec_from_file_location("spoke_audit", HERE / "audit.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
invoke, metadata, sha = module.invoke, module.metadata, module.sha
ROOT = HERE.parents[3]


def run(out, repeats):
    out.mkdir(parents=True, exist_ok=False)
    rows = []
    reference = None
    source_hashes = {str(p.relative_to(ROOT)): sha(p) for folder in ('src', 'spec/types', 'test') for p in sorted((ROOT / folder).rglob('*')) if p.is_file()}
    diagnostic_hashes = {p.name: sha(p) for p in (pathlib.Path(__file__), HERE / 'route.ts')}

    for repeat in range(1, repeats + 1):
        for direction in ('downward', 'upward', 'leftward', 'rightward'):
            directory = out / f'{repeat}-{direction}'
            directory.mkdir()
            before = directory / 'before.kicad_pcb'
            after = directory / 'after.kicad_pcb'
            shutil.copyfile(HERE.parent / 'route-input.kicad_pcb', before)
            for board in (before, after):
                for ext in ('kicad_pro', 'kicad_dru'):
                    shutil.copyfile(HERE.parent / f'thermal.{ext}', board.with_suffix('.' + ext))
            invoke(['/usr/bin/python3', HERE.parent / 'audit.py', '--refill', before], directory, 'refill')
            dsn = module.normalise_dsn(before.with_suffix('.dsn'))
            if reference is None:
                reference = dsn
            assert dsn == reference
            invoke(['kicad-cli', 'pcb', 'drc', '--severity-all', '--format', 'json', '-o', directory / 'before.json', before], directory, 'before-drc')
            initial = json.loads((directory / 'before.json').read_text())
            assert not [v for v in initial['violations'] if v['severity'] == 'error']
            assert len(initial['unconnected_items']) == 2
            metadata(before, directory / 'metadata.json')
            import pcbnew
            board = pcbnew.LoadBoard(str(before))
            pad, = [p for p in board.GetPads() if p.GetNetname() == 'GND']
            box = pad.GetBoundingBox()
            data = json.loads((directory / 'metadata.json').read_text())
            data.update(direction=direction, pad_box_nm=dict(x0=box.GetX(), y0=box.GetY(), x1=box.GetX()+box.GetWidth(), y1=box.GetY()+box.GetHeight()))
            (directory / 'metadata.json').write_text(json.dumps(data, indent=2)+'\n')
            route = subprocess.run(['bun', str(HERE / 'route.ts'), str(before.with_suffix('.dsn')), str(directory / 'metadata.json'), 'protected', str(directory / 'route.ses'), str(directory / 'engine.json')], capture_output=True, text=True, timeout=120)
            (directory / 'route.log').write_text(route.stdout + route.stderr)
            row = dict(repeat=repeat, direction=direction, route_exit=route.returncode)
            engine = json.loads((directory / 'engine.json').read_text())
            row['engine'] = engine
            if direction in ('upward', 'rightward'):
                assert route.returncode == 1
                assert engine['rejected'] == 'initial-guard-conflict'
                assert len(engine['before']['violations']) == (2 if direction == 'upward' else 1)
                assert all(v['rule'] == 'fence' for v in engine['before']['violations'])
                assert not (directory / 'route.ses').exists()
            else:
                assert route.returncode == 0
            if route.returncode == 0:
                invoke(['/usr/bin/python3', HERE.parent / 'route-audit.py', '--import-session', before, directory / 'route.ses', after], directory, 'import')
                invoke(['kicad-cli', 'pcb', 'drc', '--severity-all', '--format', 'json', '-o', directory / 'after.json', after], directory, 'drc')
                drc = json.loads((directory / 'after.json').read_text())
                from audit import parse, child
                a, b = (parse(p.read_text()) for p in (before, after))
                for key in ('setup', 'footprint', 'gr_rect'):
                    assert [n for n in a if isinstance(n, list) and n[0] == key] == [n for n in b if isinstance(n, list) and n[0] == key]
                def settings(tree):
                    return [n for n in child(tree, 'zone') if not isinstance(n, list) or n[0] not in ('filled_polygon', 'fill_segments')]
                assert settings(a) == settings(b)
                errors = dict(collections.Counter(v['type'] for v in drc['violations'] if v['severity']=='error'))
                assert errors == ({} if direction == 'downward' else {'starved_thermal': 1})
                assert len(drc['unconnected_items']) == 1
                assert all('[Net-(LO(Q)1-Pad1)]' in item['description'] for item in drc['unconnected_items'][0]['items'])
                row.update(errors=dict(collections.Counter(v['type'] for v in drc['violations'] if v['severity']=='error')), opens=len(drc['unconnected_items']), engine=json.loads((directory / 'engine.json').read_text()))
            rows.append(row)
    assert source_hashes == {name: sha(ROOT / name) for name in source_hashes}
    assert diagnostic_hashes == {p.name: sha(p) for p in (pathlib.Path(__file__), HERE / 'route.ts')}
    (out / 'summary.json').write_text(json.dumps(dict(repeats=repeats, source_hashes=source_hashes, diagnostic_hashes=diagnostic_hashes, production_fix=False, benchmark_score=False, rows=rows), indent=2)+'\n')
    print(json.dumps([{k:v for k,v in row.items() if k != 'engine'} for row in rows], indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=pathlib.Path, required=True)
    parser.add_argument('--repeats', type=int, default=3)
    args = parser.parse_args()
    run(args.out.resolve(), args.repeats)
