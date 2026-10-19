"""Run identity tests and a disposable validation-bypass mutation, three times."""
import argparse
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent


def run(output):
    output.mkdir(parents=True, exist_ok=False)
    mutation = output / 'mutation'
    mutation.mkdir()
    test = HERE / 'test_metadata_identity.py'
    (mutation / test.name).write_bytes(test.read_bytes())
    source = (HERE / 'metadata_identity.py').read_text()
    source = source[:source.index('def validate(')] + 'def validate(manifest, board, native_version):\n    pass\n'
    (mutation / 'metadata_identity.py').write_text(source)
    results = []
    for repeat in range(1, 4):
        for label, path, expected in (('candidate', test, 0),
                                      ('mutation', mutation / test.name, 1)):
            proc = subprocess.run([sys.executable, str(path)], capture_output=True,
                                  text=True, timeout=30)
            log = proc.stdout + proc.stderr
            (output / f'{label}-{repeat}.log').write_text(log)
            if proc.returncode != expected:
                raise RuntimeError(f'{label} returned {proc.returncode}, expected {expected}')
            if label == 'mutation' and 'FAILED (failures=7)' not in log:
                raise RuntimeError('Expected exactly seven mutation-sensitive identity controls')
            results.append(dict(repeat=repeat, variant=label, passed=9 if expected == 0 else 2,
                                total=9, returncode=proc.returncode))
    (output / 'summary.json').write_text(json.dumps(results, indent=2)+'\n')
    print('Three repeats verified: candidate 9/9; bypass mutation 2/9.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=pathlib.Path)
    run(parser.parse_args().out.resolve())
