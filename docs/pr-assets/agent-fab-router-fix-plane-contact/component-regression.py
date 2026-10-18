"""Compare identical requested-pour component tests on main and the guard."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
root = Path(__file__).resolve().parents[3]
files = ['test/plane-target-component.test.ts', 'test/helpers/plane-board.ts']
rows = []
with tempfile.TemporaryDirectory(prefix='plane-components-') as tmp:
    baseline = Path(tmp)
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git', 'archive', '69cf598'], cwd=root))) as archive:
        archive.extractall(baseline, filter='data')
    for name in files:
        dest = baseline / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, dest)
    for label, tree in [('before', baseline), ('after', root)]:
        for repeat in range(1, 4):
            run = subprocess.run(['bun', 'test', files[0]], cwd=tree, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
            (args.out / f'{label}-{repeat}.log').write_bytes(run.stdout)
            passed = int(re.search(rb' (\d+) pass', run.stdout)[1])
            failed = int(re.search(rb' (\d+) fail', run.stdout)[1])
            assert (passed, failed, run.returncode) == ((2, 2, 1) if label == 'before' else (4, 0, 0))
            rows.append(dict(version=label, repeat=repeat, passed=passed, failed=failed,
                             log_sha256=hashlib.sha256(run.stdout).hexdigest()))
source_files = subprocess.check_output(['git', 'ls-files', '-z', 'src', 'spec/types'], cwd=root).decode().split('\0')
result = dict(baseline='69cf598', production='dfcea61', runs=rows,
              source_sha256={p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in source_files if p},
              test_sha256={p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in files})
(args.out / 'components.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(rows, indent=2))
