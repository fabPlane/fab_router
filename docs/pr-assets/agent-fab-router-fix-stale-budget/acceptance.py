"""Compare the original no-via acceptance board with unchanged case expectations."""
import argparse
import hashlib
import io
import json
import subprocess
import tarfile
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
repo = Path(__file__).resolve().parents[3]
out = a.out.resolve()
out.mkdir(parents=True, exist_ok=False)
controls = ['spec/acceptance/boards/Issue026-J2_reference.dsn',
            'spec/acceptance/cases/routing-slow-issue026-j2-novia.json',
            'tools/acceptance/run.ts', 'tools/acceptance/run-case.ts']
sources, runs = {}, []
for label, revision in [('before', '69cf598'), ('after', '76534d6')]:
    tree = out / label
    tree.mkdir()
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(
            ['git', 'archive', revision], cwd=repo))) as archive:
        archive.extractall(tree, filter='data')
    (tree / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
    paths = controls + [str(f.relative_to(tree)) for folder in ('src', 'spec/types')
                       for f in sorted((tree / folder).rglob('*')) if f.is_file()]
    hashes = {name: hashlib.sha256((tree / name).read_bytes()).hexdigest() for name in paths}
    sources[label] = dict(revision=revision, sha256=hashes)
    for name in controls:
        assert hashes[name] == hashlib.sha256(subprocess.check_output(
            ['git', 'show', f'69cf598:{name}'], cwd=repo)).hexdigest()
    for repeat in range(1, 4):
        report = out / f'{label}-{repeat}.json'
        result = subprocess.run(['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout', '180',
            'bun', 'run', 'tools/acceptance/run.ts', '--tier', 'slow', '--case',
            'routing-slow-issue026-j2-novia', '--report', str(report)],
            cwd=tree, capture_output=True, timeout=190)
        log = out / f'{label}-{repeat}.log'
        log.write_bytes(result.stdout + result.stderr)
        assert result.returncode in (0, 1), log
        data = json.loads(report.read_text())
        assert len(data['cases']) == 1 and not data['invalidCases'] and not data['acceptStubs']
        case = data['cases'][0]
        assert case['expected']['incomplete'] == {'max': 6} and not case['stub']
        assert case['measured']['violationsAdded'] == 0
        assert case['measured']['addedBarrels'] == 0
        assert not case['measured']['timedOut'] and not case['measured']['aborted']
        runs.append(dict(variant=label, revision=revision, repeat=repeat,
            exit_code=result.returncode, report=data,
            report_sha256=hashlib.sha256(report.read_bytes()).hexdigest(),
            log_sha256=hashlib.sha256(log.read_bytes()).hexdigest()))
        print(label, repeat, case['pass'], case['measured'], flush=True)
    assert all(hashlib.sha256((tree / name).read_bytes()).hexdigest() == value
               for name, value in hashes.items())
(out / 'comparison.json').write_text(json.dumps(dict(
    scope='Engine acceptance only; no native refill/DRC or adapter coverage',
    controls=controls, sources=sources, runs=runs), indent=2) + '\n')
