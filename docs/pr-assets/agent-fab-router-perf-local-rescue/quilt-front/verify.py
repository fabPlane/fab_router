"""Replay archived evidence, including byte-identical derived outputs."""
from pathlib import Path
import gzip,hashlib,json,tempfile
import report
here=Path(__file__).resolve().parent
records=json.loads(gzip.decompress((here/'records.json.gz').read_bytes()))
report.source_check(json.loads((here/'source-audit.json').read_text()),gzip.decompress((here/'quilt-candidate.ts.gz').read_bytes()))
with tempfile.TemporaryDirectory() as temp:
 out=Path(temp);report.emit(records,out)
 for name in ('summary.json','table.md','chart.svg'):assert (out/name).read_bytes()==(here/name).read_bytes(),name
manifest=json.loads((here/'manifest.json').read_text())
for name,digest in manifest.items():assert hashlib.sha256((here/name).read_bytes()).hexdigest()==digest,name
print('PASS archived parity, exact source inversion, derived byte replay, manifest')
