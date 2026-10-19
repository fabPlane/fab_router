#!/usr/bin/python3
"""Native rule-loading sentinel diagnostic; expected errors reveal silent fallback.

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
    valid = '(rule "width" (condition "A.NetName == \'GND\'") (constraint thermal_spoke_width (min 0.4mm) (opt 0.4mm) (max 0.4mm)))\n'
    invalid = '(rule "invalid" (constraint no_such_constraint (min 0.3mm)))\n'
    sentinel = '(rule "loading sentinel" (constraint disallow track))\n'
    rules = {
        'valid-only': '(version 1)\n' + valid,
        'valid-sentinel': '(version 1)\n' + valid + sentinel,
        'sentinel-before-invalid': '(version 1)\n' + valid + sentinel + invalid,
        'sentinel-after-invalid': '(version 1)\n' + valid + invalid + sentinel,
        'sentinel-before-unclosed': '(version 1)\n' + valid + sentinel + '(rule "unclosed"\n',
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
            sentinels = [v for v in errors if v['type'] == 'items_not_allowed'
                         and "rule 'loading sentinel'" in v['description']]
            expected_sentinels = 1 if label == 'valid-sentinel' else 0
            assert len(sentinels) == expected_sentinels, (label, errors)
            assert len(errors) == expected_sentinels, (label, errors)
            assert len(data['unconnected_items']) == 2
            expected = 400 if label in ('valid-only', 'valid-sentinel') else 508
            assert all(s['count'] == expected for s in snapshot['sections'].values()), snapshot
            rows.append(dict(repeat=repeat, variant=label, exit_code=result.returncode,
                             errors=len(errors), sentinel_errors=len(sentinels), opens=len(data['unconnected_items']),
                             snapshot=snapshot, rules_sha256=width.digest(board.with_suffix('.kicad_dru'))))
    (out / 'summary.json').write_text(json.dumps(dict(repeats=3, routing_benchmark=False,
        production_fix=False, script_sha256=width.digest(pathlib.Path(__file__)), rows=rows), indent=2)+'\n')
    print('Verified expected sentinel error disappears under invalid rule loading, three repeats each.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=pathlib.Path)
    run(parser.parse_args().out.resolve())
