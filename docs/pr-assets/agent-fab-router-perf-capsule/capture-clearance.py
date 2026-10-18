"""Create an isolated source archive that calls a bounded clearance sampler."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('repository', type=Path)
p.add_argument('commit')
p.add_argument('output', type=Path)
a = p.parse_args()
if a.output.exists():
    p.error('output already exists')
commit = subprocess.check_output(['git', '-C', str(a.repository), 'rev-parse', a.commit], text=True).strip()
archive = subprocess.check_output(['git', '-C', str(a.repository), 'archive', commit, 'src', 'spec', 'package.json'])
a.output.mkdir(parents=True)
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    tar.extractall(a.output, filter='data')
path = a.output / 'src/route/clear.ts'
original = path.read_bytes()
marker = 'function closerConvex(a: ConvexShape, b: ConvexShape, required: number, orTouching: boolean): boolean {'
text = original.decode()
assert text.count(marker) == 1
text = text.replace(marker, '''const __captureClearance = (globalThis as typeof globalThis & {
  __captureClearance: (a: ConvexShape, b: ConvexShape, required: number, touching: boolean) => void
}).__captureClearance;

''' + marker + '\n  __captureClearance(a, b, required, orTouching);')
path.write_text(text)
metadata = {
    'commit': commit,
    'archive_sha256': hashlib.sha256(archive).hexdigest(),
    'generator_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'original_clear_sha256': hashlib.sha256(original).hexdigest(),
    'instrumented_clear_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
}
(a.output / 'clearance-capture.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata))
