#!/usr/bin/env python3
"""Reproduce the pinned plane-contact/via-form integration without changing this checkout."""
import argparse
import difflib
import hashlib
import io
import json
import re
import subprocess
import tarfile
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
a.out.mkdir(parents=True, exist_ok=False)
root = Path(__file__).resolve().parents[3]
refs = dict(main='69cf598', fallback='1f898f4', plane='8aff4ae40974fcaa69f70cba88ebcc1db15dd990')
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
def sha(data):
    return hashlib.sha256(data).hexdigest()
tests = {}
for label, prefix in [('fallback', 'via-fallback'), ('plane', 'plane-')]:
    for path in git('ls-tree', '-r', '--name-only', refs[label], 'test').decode().splitlines():
        if prefix in path:
            tests[path] = git('show', f'{refs[label]}:{path}')
sources = {}
for label, ref in [*refs.items(), ('composed', refs['plane'])]:
    source = a.out / label
    source.mkdir()
    with tarfile.open(fileobj=io.BytesIO(git('archive', ref))) as archive:
        archive.extractall(source, filter='data')
    (source / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
    for path, data in tests.items():
        (source / path).parent.mkdir(parents=True, exist_ok=True)
        (source / path).write_bytes(data)
    sources[label] = source
via = sources['composed'] / 'src/route/via.ts'
original = via.read_text()
text = original
fallback = git('show', f"{refs['fallback']}:src/route/via.ts").decode()
helper = fallback[fallback.index('/** Preserve exact-span'):fallback.index('export interface ViaDrop')]
text = text.replace('export interface ViaDrop', helper + 'export interface ViaDrop', 1)
old = """  const cand = pickBarrel(profile, sheet, otherSheet);
  if (!cand) return undefined;
"""
new = """  for (const cand of barrelChoices(profile, sheet, otherSheet)) {
    if (shouldStop?.()) return undefined;
    yield* dropsWithCandidate(layout, lattice, sheet, target, profile, ignore, maxRadius, cand, shouldStop);
  }
  return undefined;
}

/** Exhaust placements for each form before advancing to the next permitted form. */
function* dropsWithCandidate(
  layout: Layout, lattice: Lattice, sheet: number, target: Pt,
  profile: Profile, ignore: IgnoreSet, maxRadius: number, cand: BarrelCandidate,
  shouldStop?: () => boolean,
): Generator<ViaDrop, undefined> {
"""
assert text.count(old) == 1
text = text.replace(old, new)
via.write_text(text)
(a.out / 'composition.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True), text.splitlines(True), fromfile='a/src/route/via.ts', tofile='b/src/route/via.ts')))
runs = []
for label, source in sources.items():
    for repeat in range(1, 4):
        cmd = ['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout', '180', 'bun', 'test',
               'test/via-fallback.test.ts', 'test/plane-contact.test.ts', 'test/plane-candidate-search.test.ts',
               'test/plane-search-stop.test.ts', 'test/plane-target-component.test.ts']
        result = subprocess.run(cmd, cwd=source, capture_output=True, text=True)
        log = result.stdout + result.stderr
        (a.out / f'{label}-{repeat}.log').write_text(log)
        passed = int(re.search(r'(\d+) pass', log)[1])
        failed = int(re.search(r'(\d+) fail', log)[1])
        assert result.returncode == (0 if failed == 0 else 1), log
        expected = dict(main=(9, 18), fallback=(12, 15), plane=(24, 3), composed=(27, 0))
        assert (passed, failed) == expected[label], log
        runs.append(dict(version=label, repeat=repeat, passed=passed, failed=failed, log=log))
    assert len({(r['passed'], r['failed']) for r in runs if r['version'] == label}) == 1
interaction = root / 'docs/pr-assets/agent-fab-router-fix-via-fallback/integration.ts'
(sources['composed'] / 'test/via-integration.test.ts').write_bytes(interaction.read_bytes())
interaction_runs = []
for repeat in range(1, 4):
    result = subprocess.run(['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout', '60',
                             'bun', 'test', 'test/via-integration.test.ts'],
                            cwd=sources['composed'], capture_output=True, text=True)
    log = result.stdout + result.stderr
    (a.out / f'interaction-{repeat}.log').write_text(log)
    assert result.returncode == 0 and '3 pass' in log and '0 fail' in log, log
    interaction_runs.append(dict(repeat=repeat, log=log, log_sha256=sha(log.encode())))
cmd = ['taskset', '-c', '20-25', 'nice', '-n', '10', 'timeout', '900', 'bash', '-c',
       'bun run typecheck && bun run check:layers && bun run test']
result = subprocess.run(cmd, cwd=sources['composed'], capture_output=True, text=True)
log = result.stdout + result.stderr
(a.out / 'composed-checks.log').write_text(log)
assert result.returncode == 0, log[-6000:]
summary = dict(refs=refs, tests={p: sha(d) for p,d in tests.items()},
               sources={label: {str(f.relative_to(source)): sha(f.read_bytes())
                       for f in sorted((source/'src').rglob('*.ts'))} for label,source in sources.items()},
               runs=runs, interaction_runs=interaction_runs, interaction_sha256=sha(interaction.read_bytes()), checks=dict(command=cmd, returncode=result.returncode, log_sha256=sha(log.encode()), tail=log[-700:]),
               scope='Synthetic integration only; no composed native score or performance claim.')
(a.out / 'composition.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps({r['version']: (r['passed'], r['failed']) for r in runs}))
