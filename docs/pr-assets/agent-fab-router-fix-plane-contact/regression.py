"""Run the identical plane-contact regressions on a baseline tree and this checkout."""
import argparse
import hashlib
import io
import json
import re
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
with tempfile.TemporaryDirectory(prefix='plane-contact-') as tmp:
    baseline = Path(tmp)
    archive = subprocess.check_output(['git', 'archive', args.baseline], cwd=root)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(baseline, filter='data')
    for file in ['test/plane-contact.test.ts', 'test/helpers/plane-board.ts', 'docs/pr-assets/agent-fab-router-fix-plane-contact/audit.ts']:
        dest = baseline / file
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / file, dest)
    for label, tree in [('before', baseline), ('after', root)]:
        for repeat in range(1, args.repeats + 1):
            run = subprocess.run(['bun', 'test', 'test/plane-contact.test.ts'], cwd=tree,
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
            log = args.out / f'{label}-{repeat}.log'
            log.write_bytes(run.stdout)
            audit = subprocess.check_output(['bun', 'run', 'docs/pr-assets/agent-fab-router-fix-plane-contact/audit.ts'], cwd=tree, timeout=120)
            (args.out / f'{label}-{repeat}.json').write_bytes(audit)
            results.append({'audit': json.loads(audit), 'version': label, 'repeat': repeat, 'exit_code': run.returncode,
                            'log_sha256': hashlib.sha256(run.stdout).hexdigest(),
                            'passed': int(re.search(rb' (\d+) pass', run.stdout)[1]),
                            'failed': int(re.search(rb' (\d+) fail', run.stdout)[1])})
print(json.dumps(results, indent=2))
if any(r['exit_code'] != (1 if r['version'] == 'before' else 0) for r in results):
    raise SystemExit('Unexpected regression outcome')

assert all((r['passed'], r['failed']) == ((2, 4) if r['version'] == 'before' else (6, 0)) for r in results)
for label in ['before', 'after']:
    audits = [r['audit'] for r in results if r['version'] == label]
    assert all(a == audits[0] for a in audits), 'non-deterministic fixture audit'
    expected = 3 if label == 'before' else 0
    assert audits[0]['repeated'] == {'completed': expected, 'incomplete': 1, 'added': {'tracks': 0, 'barrels': expected}, 'violations': 0}
    for case in audits[0]['results']:
        assert case['joined'] == (case['mode'] == 'under-pad')
        assert case['success'] == (label == 'before' or case['joined'])
        assert case['drc']['violations'] == 0
