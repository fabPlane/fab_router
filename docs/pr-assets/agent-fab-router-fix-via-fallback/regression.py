"""Repeat identical tests and geometry audits against main and the current source tree."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import tarfile

p = argparse.ArgumentParser()
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
a.out.mkdir(parents=True, exist_ok=False)
root = Path(__file__).resolve().parents[3]
files = ['test/via-fallback.test.ts', 'test/helpers/via-fallback.ts']

def run(cmd, cwd):
    return subprocess.run(['taskset', '-c', '20-25', 'nice', '-n', '10', *cmd], cwd=cwd,
                          text=True, capture_output=True, timeout=120)

audit = '''import { blockedFirstViaBoard } from './test/helpers/via-fallback.ts';
import { route, checkDrc, layoutStats } from './src/api.ts';
import { buildLattice } from './src/lattice/index.ts';
import { connectivity } from './src/drc/index.ts';
const layout = blockedFirstViaBoard();
const rep = route(layout, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false });
console.log(JSON.stringify({ added: rep.added, violations: checkDrc(layout).counts.violations,
  opens: layoutStats(layout).connections.incomplete, joined: layout.barrels.length > 0 &&
  connectivity(layout, buildLattice(layout)).neighbours(10).includes(layout.barrels[0]!.id),
  pad: layout.pads[0], fences: layout.fences, barrels: layout.barrels, tracks: layout.tracks }));
'''
result = {'baseline': '69cf598', 'repeats': 3, 'tests_sha256': {
    f: hashlib.sha256((root / f).read_bytes()).hexdigest() for f in files},
    'src_sha256': {str(f.relative_to(root)): hashlib.sha256(f.read_bytes()).hexdigest()
                   for f in sorted((root / 'src').rglob('*.ts'))}, 'versions': {}}
for label in ['before', 'after']:
    dest = a.out / label
    dest.mkdir()
    data = subprocess.check_output(['git', 'archive', '69cf598'], cwd=root)
    with tarfile.open(fileobj=io.BytesIO(data)) as tf:
        tf.extractall(dest, filter='data')
    if label == 'after':
        shutil.copytree(root / 'src', dest / 'src', dirs_exist_ok=True)
    for f in files:
        (dest / f).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / f, dest / f)
    (dest / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
    (dest / 'audit.ts').write_text(audit)
    records = []
    for repeat in range(1, 4):
        check = run(['bun', 'test', 'test/via-fallback.test.ts'], dest)
        log = check.stdout + check.stderr
        (a.out / f'{label}-{repeat}.log').write_text(log)
        passes = int(re.search(r'(\d+) pass', log)[1])
        failures = int(re.search(r'(\d+) fail', log)[1])
        assert (passes, failures, check.returncode) == ((5, 3, 1) if label == 'before' else (8, 0, 0)), log
        geom = run(['bun', 'run', 'audit.ts'], dest)
        assert geom.returncode == 0, geom.stderr
        geometry = json.loads(geom.stdout)
        assert geometry['violations'] == 0
        assert geometry['opens'] == (1 if label == 'before' else 0)
        assert geometry['added'] == {'tracks': 0, 'barrels': 0 if label == 'before' else 1}
        assert geometry['joined'] == (label == 'after')
        records.append({'repeat': repeat, 'passed': passes, 'failed': failures,
                        'log_sha256': hashlib.sha256(log.encode()).hexdigest(), 'log': log, 'geometry': geometry})
    assert all(r['geometry'] == records[0]['geometry'] for r in records)
    result['versions'][label] = records
(a.out / 'regressions.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({label: [(r['passed'], r['failed']) for r in records]
                  for label, records in result['versions'].items()}))
