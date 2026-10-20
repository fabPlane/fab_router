"""Reproduce rejected engine replays. Usage: python3 reproduce.py ENGINE_REPO NEW_OUT
Requires the measured Git commit, installed repo node_modules, Bun, Python and core set 12-19.
These commands do not execute native checking or produce a full-suite score.
"""
from pathlib import Path
import gzip, hashlib, json, shutil, subprocess, sys

asset = Path(__file__).resolve().parent
prepare_only = '--prepare-only' in sys.argv
repo, out = [Path(x).resolve() for x in sys.argv[1:] if x != '--prepare-only']
out.mkdir(exist_ok=False)
audit = json.loads((asset / 'source-audit.json').read_text())
support = list(audit['test_support_files'])
for mode in ['original', 'candidate']:
    p = out / mode
    p.mkdir()
    subprocess.run(['tar', '-x', '-C', p], input=subprocess.check_output([
        'git', '-C', repo, 'archive', audit['base_commit'], 'src', 'spec', 'test', 'tools',
        'package.json', 'tsconfig.json', *support]), check=True)
    (p / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
subprocess.run([sys.executable, asset / 'lift.py', out / 'candidate'], check=True)
for mode in ['original', 'candidate']:
    for name, expected in audit['files'][mode].items():
        assert hashlib.sha256((out / mode / name).read_bytes()).hexdigest() == expected, (mode, name)
    for name, expected in audit['test_support_files'].items():
        assert hashlib.sha256((out / mode / name).read_bytes()).hexdigest() == expected, (mode, name)
for name in ['stress.ts', 'replay.ts', 'summarize.py']:
    shutil.copyfile(asset / name, out / name)
inp = out / 'aquarius-input'
inp.mkdir()
for name in ['board.dsn', 'dsn-manifest.json', 'candidate-settings.json']:
    (inp / name).write_bytes(gzip.decompress((asset / (name + '.gz')).read_bytes()))
(out / 'l2.dsn').write_bytes(gzip.decompress((asset / 'l2.dsn.gz').read_bytes()))
s = (asset / 'original-run.py').read_text()
s = s.replace("(w/'stress.ts').write_text(Path('/home/hyper/bench/wt/fr-perf/docs/pr-assets/agent-fab-router-perf-local-rescue/l3-replication/stress.ts').read_text())", '')
s = s.replace("Path('/home/hyper/bench/boards/ladder/l2-cycle18.dsn')", "w/'l2.dsn'")
(out / 'run.py').write_text(s)
s = (asset / 'original-aquarius.py').read_text()
s = s.replace("Path((w.parent/'cycle81/work-path.txt').read_text().strip())", "w/'aquarius-input'")
# The original diagnostic verifier compared elapsed recovery-log seconds literally.
# Preserve that original script, but use the corrected narrow verifier after replay.
s = s[:s.index("keys=['settings'")]
(out / 'aquarius.py').write_text(s)
if prepare_only:
    print('PASS immutable snapshots, exact generated patch, complete source/test/support hashes and staged replay scripts')
    sys.exit(0)
for name, command in [
    ('l2', ['taskset', '-c', '12-19', 'nice', '-n', '10', 'timeout', '--kill-after=5', '1200', sys.executable, out / 'run.py']),
    ('aquarius', ['timeout', '--kill-after=10', '2000', sys.executable, out / 'aquarius.py']),
]:
    with (out / (name + '-supervisor.log')).open('w') as log:
        subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, check=True)
subprocess.run([sys.executable, out / 'summarize.py'], check=True)
