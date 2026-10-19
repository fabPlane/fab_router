"""Check the five previously capped pairs on fresh input, without engine instrumentation."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--acceptance-out', type=Path, required=True)
a = p.parse_args()
root = a.acceptance_out.resolve()
fixture = Path(__file__).with_name('pairs.fixture.ts').read_bytes()
evidence = json.loads((root / 'comparison.json').read_text())
runs = []
for label in ('before', 'after'):
    tree = root / label
    (tree / 'pairs.ts').write_bytes(fixture)
    for repeat in range(1, 4):
        result = subprocess.run(['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout',
            '180', 'bun', 'pairs.ts'], cwd=tree, capture_output=True, timeout=190)
        prefix = root / f'pairs-{label}-{repeat}'
        prefix.with_suffix('.log').write_bytes(result.stderr)
        assert result.returncode == 0, result.stderr.decode()
        prefix.with_suffix('.json').write_bytes(result.stdout)
        data = json.loads(result.stdout)
        runs.append(dict(variant=label, repeat=repeat, attempts=data['attempts'],
            report_sha256=hashlib.sha256(result.stdout).hexdigest(),
            log_sha256=hashlib.sha256(result.stderr).hexdigest()))
        print(label, repeat, [(x['pair']['net'], x['connected']) for x in data['attempts']], flush=True)
    assert all(hashlib.sha256((tree / name).read_bytes()).hexdigest() == value
               for name, value in evidence['sources'][label]['sha256'].items())
(root / 'pairs-comparison.json').write_text(json.dumps(dict(
    scope='Fresh-input engine diagnostics; no native DRC or full-routing completion proof',
    fixture_sha256=hashlib.sha256(fixture).hexdigest(), runs=runs), indent=2) + '\n')
