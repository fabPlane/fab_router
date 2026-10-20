"""Verify every retained attempt and narrowly normalize elapsed diagnostic fields."""
from pathlib import Path
import gzip, hashlib, json, shutil, subprocess, sys, tempfile

asset = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
sha = lambda raw: hashlib.sha256(raw).hexdigest()
audit = json.loads((asset / 'source-audit.json').read_text())
assert audit['modified'] == ['src/lattice/grid.ts']
assert {n for n in audit['files']['original'].keys() | audit['files']['candidate'].keys()
        if audit['files']['original'].get(n) != audit['files']['candidate'].get(n)} == {'src/lattice/grid.ts'}
for mode in ['original', 'candidate']:
    raw = gzip.decompress((asset / f'{mode}-grid.ts.gz').read_bytes())
    assert sha(raw) == audit['files'][mode]['src/lattice/grid.ts']
assert sha(gzip.decompress((asset / 'l2.dsn.gz').read_bytes())) == audit['input']['sha256']
assert sha(gzip.decompress((asset / 'board.dsn.gz').read_bytes())) == audit['aquarius_input_sha256']

with tempfile.TemporaryDirectory(prefix='query-predicate-') as tmp:
    out = Path(tmp)
    for name in ['records.json', 'aquarius-records.json']:
        (out / name).write_bytes(gzip.decompress((asset / (name + '.gz')).read_bytes()))
    l2 = json.loads((out / 'records.json').read_text())
    aquarius = json.loads((out / 'aquarius-records.json').read_text())
    reference = gzip.decompress((asset / 'aquarius-reference.ses.gz').read_bytes())
    for rows in [l2, aquarius]:
        assert {(r['pair'], r['mode']) for r in rows} == {(i, m) for i in range(1, 4) for m in ['original', 'candidate']}
    for r in aquarius:
        name = f"aquarius-{r['pair']}-{r['mode']}.jsonl.gz"
        raw = json.loads(gzip.decompress((asset / name).read_bytes()))
        assert raw == {k: v for k, v in r.items() if k not in ['pair', 'mode']}
        assert sha(reference) == r['ses_sha256']
        assert r['input_sha256'] == audit['aquarius_input_sha256']
        assert r['grid_sha256'] == audit['files'][r['mode']]['src/lattice/grid.ts']
        for field, name in [('bounds_sha256', 'src/geom/bounds.ts'),
                            ('clear_sha256', 'src/route/clear.ts'),
                            ('distance_sha256', 'src/geom/distance.ts')]:
            assert r[field] == audit['files'][r['mode']][name]
    for r in l2:
        name = f"{r['pair']}-{r['mode']}"
        (out / name).mkdir()
        for file in ['board.ses', 'result.json']:
            (out / name / file).write_bytes(gzip.decompress((asset / name / (file + '.gz')).read_bytes()))
    shutil.copyfile(asset / 'summarize.py', out / 'summarize.py')
    subprocess.run([sys.executable, out / 'summarize.py'], check=True, stdout=subprocess.DEVNULL)
    assert json.loads((out / 'summary.json').read_text()) == json.loads(gzip.decompress((asset / 'summary.json.gz').read_bytes()))
print('PASS twelve attempts, input/source/session hashes, reports, statistics, normalized logs and summary')
