#!/usr/bin/env python3
"""Archive all evidence, storing identical contents once; verify exact extraction."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile
import tempfile

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('results',type=Path)
p.add_argument('output',type=Path)
a=p.parse_args()
manifest=json.loads((a.output/'archive-sha256.json').read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
seen={}
with tarfile.open(a.output/'native.tar.gz','w:gz') as archive:
    for name,digest in sorted(manifest.items()):
        path=a.results/name
        assert sha(path.read_bytes())==digest
        info=archive.gettarinfo(str(path),arcname=name)
        if digest in seen:
            info.type=tarfile.LNKTYPE;info.linkname=seen[digest];info.size=0
            archive.addfile(info)
        else:
            with path.open('rb') as stream:archive.addfile(info,stream)
            seen[digest]=name
with tempfile.TemporaryDirectory(prefix='thermal-dedup-roundtrip-') as directory:
    with tarfile.open(a.output/'native.tar.gz') as archive:
        archive.extractall(directory,filter='data')
    actual={str(path.relative_to(directory)):sha(path.read_bytes())
            for path in Path(directory).rglob('*') if path.is_file()}
    assert actual==manifest
print(f'PASS: {len(manifest)} exact file hashes after extraction; {len(seen)} distinct contents stored')
