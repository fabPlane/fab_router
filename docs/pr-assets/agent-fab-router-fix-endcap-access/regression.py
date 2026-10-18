"""Run the identical endcap-access regressions on a baseline tree and this checkout."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--baseline', default='69cf598')
parser.add_argument('--repeats', type=int, default=3)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[3]
args.out.mkdir(parents=True, exist_ok=True)
results = []
with tempfile.TemporaryDirectory(prefix='endcap-access-') as tmp:
    baseline = Path(tmp)
    archive = subprocess.check_output(['git', 'archive', args.baseline], cwd=root)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(baseline, filter='data')
    for file in ['test/endcap-access.test.ts', 'test/helpers/endcap-board.ts']:
        dest = baseline / file
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / file, dest)
    for label, tree in [('before', baseline), ('after', root)]:
        for repeat in range(1, args.repeats + 1):
            run = subprocess.run(['bun', 'test', 'test/endcap-access.test.ts'], cwd=tree,
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
            log = args.out / f'{label}-{repeat}.log'
            log.write_bytes(run.stdout)
            results.append({'version': label, 'repeat': repeat, 'exit_code': run.returncode,
                            'log_sha256': hashlib.sha256(run.stdout).hexdigest()})
print(json.dumps(results, indent=2))
if any(r['exit_code'] != (1 if r['version'] == 'before' else 0) for r in results):
    raise SystemExit('Unexpected regression outcome')
