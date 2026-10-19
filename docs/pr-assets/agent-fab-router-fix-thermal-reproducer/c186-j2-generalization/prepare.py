"""Reconstruct disposable J2small sources from the earlier public archive."""
import argparse,json,tarfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);x=p.parse_args()
x.out.mkdir(parents=True,exist_ok=False)
root=Path(__file__).resolve().parent.parent
with tarfile.open(root/'c175-complete-search/native.tar.gz') as archive:archive.extractall(x.out/'previous',filter='data')
z=json.loads((x.out/'previous/native/summary.json').read_text())
for role in ('original-segment','original-input'):
    d=x.out/role;d.mkdir()
    for name,digest in z['source_sha256'].items():
        if role in name:(d/('board'+Path(name).suffix)).write_bytes((x.out/'previous/native/sources'/digest).read_bytes())
