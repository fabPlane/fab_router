"""Run the terminal regression tests against main without changing the worktree."""
import re
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[3]
source = subprocess.check_output(['git', 'show', '69cf598:src/route/shove.ts'], cwd=root, text=True)
source = re.sub(r'from "(\.[^"]+)"', lambda m:
    'from "' + str((root / 'src/route' / m[1]).resolve()) + '"', source)
with tempfile.TemporaryDirectory(prefix='shove-regression-') as scratch:
    baseline = Path(scratch) / 'shove.ts'
    baseline.write_text(source)
    tests = (root / 'test/shove-terminals.test.ts').read_text()
    tests = re.sub(r"from '(\.[^']+)'", lambda m:
        "from '" + str((root / 'test' / m[1]).resolve()) + "'", tests)
    tests = tests.replace(str(root / 'src/route/shove.ts'), str(baseline))
    target = Path(scratch) / 'baseline.test.ts'
    target.write_text(tests)
    result = subprocess.run(['bun', 'test', str(target)], cwd=root)
    raise SystemExit(result.returncode)
