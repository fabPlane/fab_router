"""Prepare an isolated cell-key hoisting experiment from the recorded source revision."""
from pathlib import Path
import gzip, hashlib, io, json, subprocess, sys, tarfile
ROOT=Path(__file__).resolve().parents[4]
out=Path(sys.argv[1]).resolve(); assert not out.exists(); out.mkdir(parents=True)
revision='5c187d3'
for mode in ('original','candidate'):
    source=out/mode; source.mkdir()
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',revision],cwd=ROOT))) as archive:
        archive.extractall(source,filter='data')
    (source/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
p=out/'candidate/src/lattice/grid.ts'; s=p.read_text()
needle="""      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          const list = g.cells.get(keyOf(cx, cy));"""
replacement="""      for (let cx = cx0; cx <= cx1; cx++) {
        const keyBase = (cx + KEY_OFFSET) * KEY_STRIDE;
        for (let cy = cy0; cy <= cy1; cy++) {
          const list = g.cells.get(keyBase + (cy + KEY_OFFSET));"""
assert s.count(needle)==1
s=s.replace(needle,replacement)
p.write_text(s)
audit={}
for raw in subprocess.check_output(['git','ls-tree','-r','--name-only','-z',revision,'src','spec','test'],cwd=ROOT).split(b'\0'):
    if not raw: continue
    name=raw.decode(); audit[name]={mode:hashlib.sha256((out/mode/name).read_bytes()).hexdigest() for mode in ('original','candidate')}
assert [k for k,v in audit.items() if v['original']!=v['candidate']]==['src/lattice/grid.ts']
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'grid-candidate.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
inputs=out/'input'; inputs.mkdir()
for name,archive in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((ROOT/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'/archive).read_bytes()))
