"""Validate pad-edge/end-cap integration in disposable trees; no native score implied."""
import argparse
import difflib
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--repeats', type=int, default=3)
parser.add_argument('--full', action='store_true', help='Run required checks on the composition')
args = parser.parse_args()
args.out = args.out.resolve()
args.out.mkdir(parents=True, exist_ok=True)

def git(*cmd):
    return subprocess.check_output(['git', *cmd], cwd=ROOT)

def digest(data):
    return hashlib.sha256(data).hexdigest()

pad_ref = 'f5f2a7f'
endcap_ref = 'e65b9c3'
source_file = 'src/route/passes.ts'
pad = git('show', f'{pad_ref}:{source_file}').decode()
endcap = git('show', f'{endcap_ref}:{source_file}').decode()
# Preserve each strategy verbatim and in its original order: on-pad short probes
# first, then the end-cap hard search with live connectivity validation/rollback.
pad_block = pad[pad.index('  // A full-width track need not'):pad.index('  return false;\n}\n\n/** Vertices and edge midpoints')]
pad_helper = pad[pad.index('/** Vertices and edge midpoints'):pad.index('/** Per-connection options')]
composed = endcap.replace('  // An end-cap can overlap', pad_block + '  // An end-cap can overlap', 1)
composed = composed.replace('/** Per-connection options', pad_helper + '/** Per-connection options', 1)
assert pad_block in composed and pad_helper in composed
assert composed.count('function endcapPoints(') == composed.count('function padAttachPoints(') == 1
patch = ''.join(difflib.unified_diff(endcap.splitlines(True), composed.splitlines(True),
                                  fromfile='a/' + source_file, tofile='b/' + source_file))
(args.out / 'composition.patch').write_text(patch)
files = {
    'test/pad-attachment.test.ts': pad_ref,
    'test/helpers/pad-attachment-board.ts': pad_ref,
    'test/endcap-access.test.ts': endcap_ref,
    'test/helpers/endcap-board.ts': endcap_ref,
}
results = []
checks = []
for label, ref in [('pad-only', pad_ref), ('endcap-only', endcap_ref), ('composed', endcap_ref)]:
    tree = args.out / label
    tree.mkdir()
    with tarfile.open(fileobj=io.BytesIO(git('archive', ref))) as archive:
        archive.extractall(tree, filter='data')
    (tree / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
    for name, revision in files.items():
        target = tree / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(git('show', f'{revision}:{name}'))
    if label == 'composed':
        (tree / source_file).write_text(composed)
    for repeat in range(1, args.repeats + 1):
        command = ['bun', 'test', 'test/pad-attachment.test.ts', 'test/endcap-access.test.ts']
        run = subprocess.run(command, cwd=tree, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
        log = args.out / f'{label}-{repeat}.log'
        log.write_bytes(run.stdout)
        passed = int(re.search(rb' (\d+) pass', run.stdout)[1])
        failed = int(re.search(rb' (\d+) fail', run.stdout)[1])
        results.append(dict(version=label, repeat=repeat, command=command, passed=passed, failed=failed,
                            exit_code=run.returncode, log_sha256=digest(run.stdout)))
    if label == 'composed' and args.full:
        command = ['bash', '-c', 'bun run typecheck && bun run check:layers && bun run test']
        run = subprocess.run(command, cwd=tree, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=900)
        (args.out / 'composed-checks.log').write_bytes(run.stdout)
        checks.append(dict(command=command, exit_code=run.returncode, log_sha256=digest(run.stdout)))
summary = dict(scope='Engine integration only; no composed native benchmark has been run',
               revisions={label: git('rev-parse', ref).decode().strip() for label, ref in [('pad', pad_ref), ('endcap', endcap_ref)]},
               source_sha256={'pad': digest(pad.encode()), 'endcap': digest(endcap.encode()), 'composed': digest(composed.encode())},
               patch_sha256=digest(patch.encode()),
               tests_sha256={name: digest(git('show', f'{ref}:{name}')) for name, ref in files.items()},
               results=results, checks=checks)
(args.out / 'composition.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
assert all(r['passed'] == 27 and r['failed'] == 0 and r['exit_code'] == 0 for r in results if r['version'] == 'composed')
assert all(c['exit_code'] == 0 for c in checks)
