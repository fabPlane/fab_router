"""Replay archived source, parity, accounting, and generated-file checks."""
from pathlib import Path
import gzip,hashlib,importlib.util,json,tempfile
p=Path(__file__).resolve().parent
for name,digest in json.loads((p/'manifest.json').read_text()).items():
    assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest,name
spec=importlib.util.spec_from_file_location('locality',p/'report.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.source_check(json.loads((p/'source-audit.json').read_text()),gzip.decompress((p/'quilt-observer.ts.gz').read_bytes()))
records=json.loads(gzip.decompress((p/'records.json.gz').read_bytes()))
with tempfile.TemporaryDirectory() as d:
    m.emit(records,Path(d))
    for name in ('summary.json','table.md','chart.svg'):
        assert (Path(d)/name).read_bytes()==(p/name).read_bytes(),name
print('archive hashes, source inversion, independent session parity and artifact replay PASS')
