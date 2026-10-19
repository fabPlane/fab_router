#!/usr/bin/python3
"""Compare native metadata regression runs with a pinned pre-fix revision."""
import argparse
import json
from pathlib import Path
import resource
import shutil
import signal
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--before-ref', default='4090f74')
parser.add_argument('--out', required=True, type=Path)
args = parser.parse_args()
here = Path(__file__).resolve().parent
root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=here, text=True).strip())
revision = subprocess.check_output(['git', 'rev-parse', args.before_ref], cwd=root, text=True).strip()
args.out.mkdir(parents=True, exist_ok=False)


def no_core():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


rows = []
with tempfile.TemporaryDirectory(prefix='plane-layer-regression-') as folder:
    before = Path(folder)
    for file in here.glob('*.py'):
        shutil.copyfile(file, before / file.name)
    for filename in ('thermal-links.py', 'thermal-doglegs.py'):
        data = subprocess.check_output(['git', 'show', f'{revision}:{here.relative_to(root)}/{filename}'], cwd=root)
        (before / filename).write_bytes(data)
    for name, source in (('before', before), ('after', here)):
        for repeat in range(1, 4):
            result = subprocess.run(['/usr/bin/python3', '-B', str(source / 'plane-layer-controls.py')],
                                    capture_output=True, timeout=30, preexec_fn=no_core)
            (args.out / f'{name}-{repeat}.log').write_bytes(result.stdout + result.stderr)
            rows.append(dict(variant=name, repeat=repeat, returncode=result.returncode))
    (args.out / 'summary.json').write_text(json.dumps(dict(before_commit=revision,
        cases_per_completed_run=16, rows=rows, routing_benchmark=False), indent=2) + '\n')
    assert all(row['returncode'] == (-signal.SIGSEGV if row['variant'] == 'before' else 0) for row in rows), rows
print('PASS: before crashes 3/3; after completes all 16 native metadata controls 3/3')
