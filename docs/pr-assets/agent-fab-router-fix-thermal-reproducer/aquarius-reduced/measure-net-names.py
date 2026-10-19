#!/usr/bin/python3
"""Compare net-name entrypoint regression runs with a pinned pre-fix revision."""
import argparse
import json
from pathlib import Path
import resource
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--before-ref', default='c3137ff')
parser.add_argument('--out', required=True, type=Path)
args = parser.parse_args()
here = Path(__file__).resolve().parent
root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=here, text=True).strip())
revision = subprocess.check_output(['git', 'rev-parse', args.before_ref], cwd=root, text=True).strip()
args.out.mkdir(parents=True, exist_ok=False)


def no_core():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


rows = []
with tempfile.TemporaryDirectory(prefix='net-name-regression-') as folder:
    before = Path(folder)
    for file in here.glob('*.py'):
        shutil.copyfile(file, before / file.name)
    for filename in ('thermal-links.py', 'thermal-doglegs.py'):
        data = subprocess.check_output(['git', 'show', f'{revision}:{here.relative_to(root)}/{filename}'], cwd=root)
        (before / filename).write_bytes(data)
    for name, source in (('before', before), ('after', here)):
        for repeat in range(1, 4):
            result = subprocess.run(['/usr/bin/python3', '-B', str(source / 'net-name-controls.py')],
                                    capture_output=True, timeout=30, preexec_fn=no_core)
            (args.out / f'{name}-{repeat}.log').write_bytes(result.stdout + result.stderr)
            if name == 'before':
                assert b'FAILED (failures=5, errors=1)' in result.stderr, result.stderr
            rows.append(dict(variant=name, repeat=repeat, returncode=result.returncode))
    (args.out / 'summary.json').write_text(json.dumps(dict(before_commit=revision,
        cases_per_completed_run=10, rows=rows, routing_benchmark=False), indent=2) + '\n')
    assert all(row['returncode'] == (1 if row['variant'] == 'before' else 0) for row in rows), rows
print('PASS: before fails 6/10 net-name cases; after passes 10/10, each repeated 3 times')
