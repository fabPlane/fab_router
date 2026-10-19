#!/usr/bin/env python3
"""Package static searches and verify a byte-exact archive round trip."""
import argparse
import gzip
import hashlib
import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--source', type=Path, required=True)
p.add_argument('--results', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
a.output.mkdir(exist_ok=False)
sha = lambda data: hashlib.sha256(data).hexdigest()
here = Path(__file__).resolve().parent
summary = json.loads((a.results / 'summary.json').read_text())
for ext, digest in summary['input_sha256'].items():
    data = a.source.with_suffix(ext).read_bytes()
    assert sha(data) == digest
    if ext == '.kicad_pcb':
        (a.output / 'source.kicad_pcb.gz').write_bytes(gzip.compress(data, mtime=0))
    else:
        (a.output / ('source' + ext)).write_bytes(data)
provenance = json.loads((a.source.parent / 'provenance.json').read_text())
assert provenance['check']['board_sha256'] == summary['input_sha256']['.kicad_pcb']
shutil.copyfile(a.source.parent / 'provenance.json', a.output / 'provenance.json')
subprocess.run(['python3', str(here / 'summarize.py'), str(a.results),
                str(a.output / 'comparison.json')], check=True)
manifest = {}
with tarfile.open(a.output / 'native.tar.gz', 'w:gz') as archive:
    for file in sorted(a.results.rglob('*')):
        if not file.is_file() or file.suffix == '.kicad_prl':
            continue
        name = str(file.relative_to(a.results))
        manifest[name] = sha(file.read_bytes())
        archive.add(file, arcname=name, recursive=False)
(a.output / 'archive-sha256.json').write_text(json.dumps(manifest, indent=2) + '\n')
with tempfile.TemporaryDirectory(prefix='thermal-roundtrip-') as directory:
    with tarfile.open(a.output / 'native.tar.gz') as archive:
        archive.extractall(directory, filter='data')
    actual = {str(f.relative_to(directory)): sha(f.read_bytes())
              for f in Path(directory).rglob('*') if f.is_file()}
    assert actual == manifest
print(f'PASS: {len(manifest)} archived file hashes match raw evidence')
