"""Prepare an isolated routing-only ordinary-pour filtering experiment from the recorded source revision."""
from pathlib import Path
import gzip, hashlib, io, json, subprocess, sys, tarfile
ROOT=Path(__file__).resolve().parents[4]
out=Path(sys.argv[1]).resolve(); assert not out.exists(); out.mkdir(parents=True)
revision='423a26d'
for mode in ('original','candidate'):
    source=out/mode; source.mkdir()
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',revision],cwd=ROOT))) as archive:
        archive.extractall(source,filter='data')
    (source/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
p=out/'candidate/src/lattice/grid.ts'; s=p.read_text()
s=s.replace('sweepHits(sheet: number, dop8: Dop8, filter?: LatticeFilter)', 'sweepHits(sheet: number, dop8: Dop8, filter?: LatticeFilter, omitOrdinaryPours?: boolean)')
s=s.replace('filter: LatticeFilter | undefined): LatticeItemRef[]', 'filter: LatticeFilter | undefined, omitOrdinaryPours = false): LatticeItemRef[]')
needle='    const push = (s: number) => {\n'
assert s.count(needle)==1
s=s.replace(needle,needle+'''      // Routing-only policy: read live metadata; raw and general queries stay unchanged.
      if (omitOrdinaryPours) {
        const entry = directory.get(sId[s]!);
        if (entry?.cat === "pour" && (entry.item as Pour).origin !== "prior") return;
      }
''')
s=s.replace('sweepHits: (sheet, dop8, filter) => collect(sheet, dop8, true, filter)', 'sweepHits: (sheet, dop8, filter, omitOrdinaryPours) => collect(sheet, dop8, true, filter, omitOrdinaryPours)')
p.write_text(s)
c=out/'candidate/src/route/clear.ts'; text=c.read_text()
assert text.count('lattice.sweepHits(sheet, q)')==1
c.write_text(text.replace('lattice.sweepHits(sheet, q)', 'lattice.sweepHits(sheet, q, undefined, true)'))
audit={}
for raw in subprocess.check_output(['git','ls-tree','-r','--name-only','-z',revision,'src','spec','test'],cwd=ROOT).split(b'\0'):
    if not raw: continue
    name=raw.decode(); audit[name]={mode:hashlib.sha256((out/mode/name).read_bytes()).hexdigest() for mode in ('original','candidate')}
assert [k for k,v in audit.items() if v['original']!=v['candidate']]==['src/lattice/grid.ts', 'src/route/clear.ts']
(out/'source-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(out/'grid-candidate.ts.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
(out/'clear-candidate.ts.gz').write_bytes(gzip.compress(c.read_bytes(),mtime=0))
inputs=out/'input'; inputs.mkdir()
for name,archive in [('board.dsn','board.dsn.gz'),('router-summary.json','reference.json.gz')]:
    (inputs/name).write_bytes(gzip.decompress((ROOT/'docs/pr-assets/agent-fab-router-perf-local-rescue/native-profile'/archive).read_bytes()))
