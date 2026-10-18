"""Trace fresh-input search and insertion separately, preserving all original obstacles."""
import argparse,hashlib,io,json,subprocess,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4];ASSETS=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
out=a.out.resolve();out.mkdir(parents=True,exist_ok=False);tree=out/'engine';tree.mkdir()
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','69cf598'],cwd=ROOT))) as t:t.extractall(tree,filter='data')
(tree/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
subprocess.run(['git','apply',str(ASSETS/'trace.patch')],cwd=tree,check=True)
(tree/'trace.ts').write_bytes((ASSETS/'trace.ts').read_bytes())
r=subprocess.run(['bun','trace.ts'],cwd=tree,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
(out/'terminals.json').write_bytes(r.stdout);(out/'trace.log').write_bytes(r.stderr);assert r.returncode==0
rows=[]
for part in r.stderr.decode().split('PAIR')[1:]:
    lines=part.splitlines();pair=json.loads(lines[0]);attempts=[]
    for line in lines[1:]:
        if line.startswith('{'):
            raw=json.loads(line);attempts.append({k:v for k,v in raw.items() if k!='path'})
        elif line=='INSERT_FAILED':attempts[-1]['insertion_failed']=True
        elif line.startswith('LEGS '):attempts[-1]['blocked_original_legs']=json.loads(line[5:])
    rows.append(dict(pair=pair,search=attempts))
assert len(rows)==12
(out/'trace-summary.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(dict(pairs=len(rows),source_sha256=hashlib.sha256((tree/'src/route/passes.ts').read_bytes()).hexdigest()),indent=2))
