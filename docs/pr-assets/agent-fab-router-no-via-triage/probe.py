"""Reproduce unresolved no-via acceptance failure; proposals remain scratch-only."""
import argparse
import difflib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[3]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--out', required=True, type=Path)
p.add_argument('--repeats', default=3, type=int)
a = p.parse_args()
assert a.repeats > 0
a.out.mkdir(parents=True, exist_ok=False)
a.out = a.out.resolve()
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def sha(data):
    return hashlib.sha256(data).hexdigest()
base = '69cf598db98c136bff16bbe02bccdded95674b18'
endcap = 'e65b9c3'
name = 'src/route/passes.ts'
original = git('show', f'{base}:{name}').decode()
marker = '  return false;\n}\n\n/** Per-connection options'
reverse = original.replace(marker, '''  for (const sheet of common) {
    if (tryRouteOnSheet(ctx, conn.net, sheet, ends.to.pt, ends.from.pt, profile, ignore, deadline, false)) return true;
  }
''' + marker, 1)
fine = original.replace('return span <= 40 * base ? [1, 2, 4] : [1, 2];', 'return [1, 2, 4, 8];', 1)
exact = original.replace('if (!soft) return CLEAR_EDGE;', '''if (!soft) {
      const hard = sweepClear(ctx.layout, ctx.lattice, sheet, { a, b }, profile, ignore, profile.width);
      return hard.ok ? CLEAR_EDGE : { blocked: true, extra: 0, rip: [] };
    }''', 1)
assert original != reverse != fine != exact
case = 'routing-slow-issue026-j2-novia'
variants = [('main', base, original), ('reverse', base, reverse), ('fine', base, fine),
            ('exact', base, exact), ('endcap', endcap, git('show', f'{endcap}:{name}').decode())]
results = []
identities = {}
for label, revision, source in variants:
    tree = a.out / label
    tree.mkdir()
    with tarfile.open(fileobj=io.BytesIO(git('archive', revision))) as archive:
        archive.extractall(tree, filter='data')
    (tree / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
    (tree / name).write_text(source)
    for frozen in ('spec/acceptance/boards/Issue026-J2_reference.dsn',
                   f'spec/acceptance/cases/{case}.json', 'tools/acceptance/run.ts',
                   'tools/acceptance/run-case.ts'):
        assert (tree / frozen).read_bytes() == git('show', f'{base}:{frozen}')
    patch = ''.join(difflib.unified_diff(original.splitlines(True), source.splitlines(True),
                                       fromfile='a/' + name, tofile='b/' + name))
    (a.out / f'{label}.patch').write_text(patch)
    identities[label] = dict(base=git('rev-parse', revision).decode().strip(),
                             patch=patch, source_sha256=sha(source.encode()),
                             sources={str(f.relative_to(tree)): sha(f.read_bytes()) for d in ('src', 'spec/types')
                                      for f in sorted((tree / d).rglob('*')) if f.is_file()})
    for repeat in range(1, a.repeats + 1):
        report = a.out / f'{label}-{repeat}.json'
        cmd = ['bun', 'run', 'tools/acceptance/run.ts', '--tier', 'slow', '--case', case, '--report', str(report)]
        run = subprocess.run(cmd, cwd=tree, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
        raw = json.loads(report.read_text())
        assert not raw['invalidCases'] and len(raw['cases']) == 1
        measured = raw['cases'][0]
        assert measured['id'] == case and not measured['stub']
        assert measured['expected']['incomplete'] == {'max': 6}
        assert measured['measured']['addedBarrels'] == 0
        assert measured['measured']['violationsAdded'] == 0
        assert not measured['measured']['timedOut'] and not measured['measured']['aborted']
        assert measured['measured']['incomplete'] == (11 if label == 'fine' else 12)
        assert run.returncode == 1 and not measured['pass']
        (a.out / f'{label}-{repeat}.log').write_bytes(run.stdout)
        results.append(dict(variant=label, repeat=repeat, command=cmd, exit_code=run.returncode,
                            log=run.stdout.decode(), report=raw, report_sha256=sha(report.read_bytes())))
    if label == 'main':
        diagnostic = Path(__file__).with_name('terminals.ts').read_bytes()
        (tree / 'terminals.ts').write_bytes(diagnostic)
        run = subprocess.run(['bun', 'terminals.ts'], cwd=tree, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, timeout=120)
        assert run.returncode == 0, run.stderr.decode()
        terminal_report = json.loads(run.stdout)
        (a.out / 'terminals.json').write_bytes(run.stdout)
summary = dict(scope='One existing engine acceptance case; no native checker or frozen-suite claim. '
                     'All variants still fail the unchanged maximum of six opens. No production fix.',
               case=case, board_sha256=sha(git('show', f'{base}:spec/acceptance/boards/Issue026-J2_reference.dsn')),
               case_sha256=sha(git('show', f'{base}:spec/acceptance/cases/{case}.json')),
               identities=identities, results=results, terminals=terminal_report,
               terminal_script_sha256=sha(Path(__file__).with_name('terminals.ts').read_bytes()))
(a.out / 'results.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps([dict(variant=r['variant'], repeat=r['repeat'], opens=r['report']['cases'][0]['measured']['incomplete']) for r in results], indent=2))
