"""Repeat identical no-yield plane cancellation regressions before/after the fix."""
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
files = ['test/plane-search-stop.test.ts', 'test/helpers/plane-board.ts']
rows = []
with tempfile.TemporaryDirectory(prefix='plane-stop-') as tmp:
    baseline = Path(tmp)
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git', 'archive', '1e832f5'], cwd=root))) as archive:
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
            assert (passed, failed, run.returncode) == ((0, 4, 1) if label == 'before' else (4, 0, 0))
            if label == 'before':
                assert run.stdout.count(b'Received: 418') == 4
            rows.append(dict(version=label, repeat=repeat, passed=passed, failed=failed,
                             log=run.stdout.decode(), log_sha256=hashlib.sha256(run.stdout).hexdigest()))
source_files = subprocess.check_output(['git', 'ls-files', '-z', 'src', 'spec/types'], cwd=root).decode().split('\0')
result = dict(baseline='1e832f5', production='working-tree', runs=rows,
              query_assertions=dict(before=[418, 418, 418, 418], after_upper_bound=[0, 0, 4, 4]),
              source_sha256={p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in source_files if p},
              test_sha256={p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in files})
(args.out / 'stops.json').write_text(json.dumps(result, indent=2) + '\n')
print('Three repeats each: before 0/4 pass, after 4/4 pass; query assertions verified.')
