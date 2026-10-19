"""Repeat the focused regression against the original and candidate source."""
import argparse
import hashlib
import io
import json
import subprocess
import tarfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[3]
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=False)
fixture = (repo / 'test/search-budget.test.ts').read_bytes()
runs = []
for label, revision in [('before', '69cf598'), ('after', '76534d6')]:
    checkout = out / label
    checkout.mkdir()
    archive = subprocess.check_output(['git', 'archive', revision], cwd=repo)
    with tarfile.open(fileobj=io.BytesIO(archive)) as contents:
        contents.extractall(checkout, filter='data')
    (checkout / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
    (checkout / 'test/search-budget.test.ts').write_bytes(fixture)
    for repeat in range(1, 4):
        result = subprocess.run(['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout', '60',
                                 'bun', 'test', 'test/search-budget.test.ts'],
                                cwd=checkout, capture_output=True)
        log = out / f'{label}-{repeat}.log'
        log.write_bytes(result.stdout + result.stderr)
        assert result.returncode == (1 if label == 'before' else 0), log
        text = log.read_text()
        assert ('4 pass\n 2 fail' if label == 'before' else '6 pass\n 0 fail') in text, log
        runs.append(dict(source=revision, variant=label, repeat=repeat,
                         returncode=result.returncode, log=log.name,
                         sha256=hashlib.sha256(log.read_bytes()).hexdigest()))
(out / 'results.json').write_text(json.dumps(runs, indent=2) + '\n')
print(out / 'results.json')
