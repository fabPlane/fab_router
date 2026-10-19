"""Create a disposable baseline archive with query-size counters; never use it for timing."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('repo',type=Path)
p.add_argument('out',type=Path)
a=p.parse_args()
if a.out.exists(): raise SystemExit('Output already exists')
raw=subprocess.check_output(['git','-C',str(a.repo),'archive','69cf598','src','spec'])
a.out.mkdir(parents=True)
with tarfile.open(fileobj=io.BytesIO(raw)) as tar: tar.extractall(a.out,filter='data')
f=a.out/'src/lattice/grid.ts'
s=f.read_text()
header='''const census = ((globalThis as any).__latticeCensus ??= {
  queries: 0, missingSheet: 0, box: Array(34).fill(0), sweep: Array(34).fill(0),
  references: 0, comparisons: 0, bucketVisits: 0, duplicateVisits: 0, shelfVisits: 0,
});
'''
s=header+s
replacements={
'    if (!g) return out;':'    census.queries++;\n    if (!g) { census.missingSheet++; return out; }',
'            if (sStamp[s] === gen) continue;':'            census.bucketVisits++;\n            if (sStamp[s] === gen) { census.duplicateVisits++; continue; }',
'    for (const s of g.shelf) if (test(s)) push(s);':'    for (const s of g.shelf) { census.shelfVisits++; if (test(s)) push(s); }',
'    out.sort((a, b) => a.id - b.id || (a.leg ?? NO_LEG) - (b.leg ?? NO_LEG));':'''    census[sweep ? "sweep" : "box"][Math.min(out.length, 33)]++;
    census.references += out.length;
    out.sort((a, b) => { census.comparisons++; return a.id - b.id || (a.leg ?? NO_LEG) - (b.leg ?? NO_LEG); });''',
}
for old,new in replacements.items():
    assert s.count(old)==1,old
    s=s.replace(old,new)
f.write_text(s)
(a.out/'census-source.json').write_text(json.dumps({'base':'69cf598','archive_sha256':hashlib.sha256(raw).hexdigest(),'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'instrumented_grid_sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'histogram_last_bin':'33 or more returned references','purpose':'diagnostic counts, not performance'},indent=2)+'\n')
