"""Replay the corpus and ensure an inclusive-for-strict mutation is rejected."""
import json
from pathlib import Path
import subprocess
import tempfile

here = Path(__file__).resolve().parent
root = here.parents[3]
source = (here / 'probe.ts').read_text()
def run(text):
    # Absolute imports keep temporary controls independent of the current directory.
    text = text.replace('../../../../src/', str(root / 'src') + '/')
    with tempfile.TemporaryDirectory(prefix='segment-threshold-') as tmp:
        script = Path(tmp) / 'probe.ts'
        script.write_text(text)
        return subprocess.run(['timeout', '60', 'bun', str(script)], capture_output=True, text=True)
result = run(source)
assert result.returncode == 0, result.stderr
expected = json.loads((here / 'summary.json').read_text())
assert json.loads(result.stdout) == expected
assert sum(expected['syntheticBins']) + expected['fallback'] == expected['comparisons']
mutant = source.replace('touching ? x <= limit : x < limit', 'touching ? x <= limit : x <= limit')
assert mutant != source
bad = run(mutant)
assert bad.returncode == 1 and 'AssertionError' in bad.stderr, bad.stderr
print('PASS: exact replay; outcome partition; inclusive-for-strict mutation rejected')
