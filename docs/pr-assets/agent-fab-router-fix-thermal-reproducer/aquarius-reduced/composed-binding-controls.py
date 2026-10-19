#!/usr/bin/python3
"""Try substituted native artifacts while preserving published summary evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    results = []
    cases = ['unchanged', 'baseline-board', 'candidate-board', 'replay-board', 'native-rules']
    for case in cases:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)/'results'
            shutil.copytree(HERE/'composed-generated-results', root)
            if case == 'baseline-board':
                shutil.copyfile(root/'candidate-1-1/board.kicad_pcb.gz', root/'baseline-1/board.kicad_pcb.gz')
            elif case == 'candidate-board':
                shutil.copyfile(root/'baseline-1/board.kicad_pcb.gz', root/'candidate-1-0/board.kicad_pcb.gz')
            elif case == 'replay-board':
                shutil.copyfile(root/'baseline-1/board.kicad_pcb.gz', root/'replay-1/board.kicad_pcb.gz')
            elif case == 'native-rules':
                (root/'candidate-1-0/board.kicad_dru').write_text('(version 1)\n')
            # Rebind hashes so a digest-only guard cannot pass these controls.
            manifest = root/'manifest.json'
            hashes = json.loads(manifest.read_text())
            for name in hashes:
                hashes[name] = hashlib.sha256((root/name).read_bytes()).hexdigest()
            manifest.write_text(json.dumps(hashes, indent=2)+'\n')
            command = ['/usr/bin/python3', str(HERE/'verify-composed.py'), '--results', str(root)]
            result = subprocess.run(command, capture_output=True, text=True, timeout=120)
            (args.out/f'{case}.log').write_text(result.stdout+result.stderr)
            reason = ('native rule sidecar differs from source' if case == 'native-rules'
                      else 'checked board differs from proposed design')
            if result.returncode and case != 'unchanged':
                assert reason in result.stderr, result.stderr
            results.append(dict(case=case, returncode=result.returncode,
                                expected_accept=case == 'unchanged', accepted=result.returncode == 0))
    (args.out/'summary.json').write_text(json.dumps(results, indent=2)+'\n')
    print(json.dumps(results, indent=2))
    assert all(row['accepted'] == row['expected_accept'] for row in results)
    print('PASS: original evidence accepted; substituted boards and rule sidecar rejected')


if __name__ == '__main__':
    main()
