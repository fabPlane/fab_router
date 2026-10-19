#!/usr/bin/python3
"""Native rule-loading diagnostic; CLI success does not prove rules were applied.

No production policy, routing, or native safety guarantee is installed.
"""
import argparse
import importlib.util
import json
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('width', HERE / 'custom-width.py')
width = importlib.util.module_from_spec(spec)
spec.loader.exec_module(width)


def run(out):
    out.mkdir(parents=True, exist_ok=False)
    rules = {
        'valid-400': '(version 1)\n(rule "width" (condition "A.NetName == \'GND\'") (constraint thermal_spoke_width (min 0.4mm) (opt 0.4mm) (max 0.4mm)))\n',
        'unknown-constraint': '(version 1)\n(rule "invalid" (constraint no_such_constraint (min 0.4mm)))\n',
        'unclosed-rule': '(version 1)\n(rule "invalid" (constraint thermal_spoke_width (min 0.4mm)\n',
    }
    rows = []
    for repeat in range(1, 4):
        for label, rule in rules.items():
            directory = out / f'{repeat}-{label}'
            directory.mkdir()
            board = directory / 'board.kicad_pcb'
            shutil.copyfile(HERE.parent / 'route-input.kicad_pcb', board)
            shutil.copyfile(HERE.parent / 'thermal.kicad_pro', board.with_suffix('.kicad_pro'))
            board.with_suffix('.kicad_dru').write_text(rule)
            report = directory / 'drc.json'
            command = ['kicad-cli', 'pcb', 'drc', '--refill-zones', '--save-board',
                       '--severity-all', '--format', 'json', '-o', str(report), str(board)]
            result = subprocess.run(command, capture_output=True, text=True, timeout=90)
            (directory / 'cli.log').write_text(result.stdout + result.stderr)
            assert result.returncode == 0, (label, result.returncode, result.stderr)
            subprocess.run([sys.executable, str(HERE / 'custom-width.py'), '--snapshot', str(board)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=90)
            snapshot = json.loads(board.with_suffix('.snapshot.json').read_text())
            data = json.loads(report.read_text())
            errors = [v for v in data['violations'] if v['severity'] == 'error']
            assert not errors, errors
            assert len(data['unconnected_items']) == 2
            expected = 400 if label == 'valid-400' else 508
            assert all(s['count'] == expected for s in snapshot['sections'].values()), snapshot
            rows.append(dict(repeat=repeat, variant=label, exit_code=result.returncode,
                             errors=len(errors), opens=len(data['unconnected_items']),
                             snapshot=snapshot, rules_sha256=width.digest(board.with_suffix('.kicad_dru'))))
    (out / 'summary.json').write_text(json.dumps(dict(repeats=3, routing_benchmark=False,
        production_fix=False, script_sha256=width.digest(pathlib.Path(__file__)), rows=rows), indent=2)+'\n')
    print('Verified valid width applied; two invalid rules silently use default geometry, three repeats each.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=pathlib.Path)
    run(parser.parse_args().out.resolve())
