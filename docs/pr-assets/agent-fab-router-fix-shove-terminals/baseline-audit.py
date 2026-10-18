"""Run the exact same fixture audit against the main revision's shove implementation."""
import re
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[3]
source = subprocess.check_output(
    ['git', 'show', '69cf598:src/route/shove.ts'], cwd=root, text=True,
)
source = re.sub(r'from "(\.[^"]+)"', lambda m:
    'from "' + str((root / 'src/route' / m[1]).resolve()) + '"', source)
with tempfile.TemporaryDirectory(prefix='shove-audit-') as scratch:
    target = Path(scratch) / 'shove.ts'
    target.write_text(source)
    subprocess.run(['bun', str(Path(__file__).with_name('audit.ts')), str(target)], cwd=root, check=True)
