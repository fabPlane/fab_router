"""Create a new instrumented source archive; never modify the source checkout.
Usage: python3 instrument-segments.py SOURCE_CHECKOUT REVISION NEW_DIRECTORY
The trace uses a deterministic bounded reservoir, for diagnosis only (not route timings).
"""
from pathlib import Path
import io
import subprocess
import sys
import tarfile
source, revision, output = sys.argv[1:]
root = Path(output)
root.mkdir(exist_ok=False)
archive = subprocess.check_output(['git', '-C', source, 'archive', revision, 'src', 'spec'])
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    tar.extractall(root, filter='data')
p = root / 'src/geom/predicates.ts'
s = p.read_text()
needle = '  if (cross(a, b, p) !== 0) return false;'
assert s.count(needle) == 1
instrument = '''  const trace = (globalThis as any).__segmentTrace;
  if (trace) {
    trace.calls++;
    if (p.x < Math.min(a.x,b.x) || p.x > Math.max(a.x,b.x) || p.y < Math.min(a.y,b.y) || p.y > Math.max(a.y,b.y)) trace.outside++;
    trace.seed=(Math.imul(trace.seed,1664525)+1013904223)>>>0;
    const index=trace.calls<=10000 ? trace.calls-1 : trace.seed%trace.calls;
    if(index<10000) trace.samples[index]=[p.x,p.y,a.x,a.y,b.x,b.y];
  }
'''
p.write_text(s.replace(needle, instrument + needle))
