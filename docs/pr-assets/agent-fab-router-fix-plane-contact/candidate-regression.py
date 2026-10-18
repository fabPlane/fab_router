"""Compare identical reachable-plane candidate tests before and after enumeration."""
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
files = ['test/plane-candidate-search.test.ts', 'test/helpers/plane-board.ts', 'docs/pr-assets/agent-fab-router-fix-plane-contact/candidate-audit.ts']
rows = []
with tempfile.TemporaryDirectory(prefix='plane-components-') as tmp:
    baseline = Path(tmp)
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git', 'archive', '3189e6c'], cwd=root))) as archive:
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
            assert (passed, failed, run.returncode) == ((0, 5, 1) if label == 'before' else (5, 0, 0))
            audit = subprocess.check_output(['bun', 'run', files[2]], cwd=tree, timeout=120)
            (args.out / f'{label}-{repeat}.json').write_bytes(audit)
            rows.append(dict(audit=json.loads(audit), version=label, repeat=repeat, passed=passed, failed=failed,
                             log_sha256=hashlib.sha256(run.stdout).hexdigest()))
for label in ['before', 'after']:
    audits = [r['audit'] for r in rows if r['version'] == label]
    assert all(a == audits[0] for a in audits), 'non-deterministic candidate geometry'
    for case in audits[0]:
        connected = label == 'after'
        assert case['success'] == connected and case['joined'] == connected
        assert case['drc']['incompletes'] == (0 if connected else 1)
        assert case['drc']['violations'] == 0
        assert len(case['barrels']) == int(connected)
        assert len(case['tracks']) == int(connected)

source_files = subprocess.check_output(['git', 'ls-files', '-z', 'src', 'spec/types'], cwd=root).decode().split('\0')
result = dict(baseline='3189e6c', production='working-tree', runs=rows,
              source_sha256={p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in source_files if p},
              test_sha256={p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in files})
(args.out / 'candidates.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(rows, indent=2))
