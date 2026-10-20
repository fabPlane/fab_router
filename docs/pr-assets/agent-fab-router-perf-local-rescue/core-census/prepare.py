from pathlib import Path
import subprocess,sys,tarfile,io,json,hashlib
root=Path(sys.argv[1]); out=Path(sys.argv[2]); out.mkdir()
blob=subprocess.check_output(['git','-C',str(root),'archive','HEAD','src','spec','package.json','tsconfig.json','bun.lock'])
with tarfile.open(fileobj=io.BytesIO(blob)) as t: t.extractall(out,filter='data')
(out/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
hashes={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for d in ['src','spec'] for p in sorted((out/d).rglob('*')) if p.is_file()}
(out/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
p=out/'src/geom/distance.ts';s=p.read_text()
anchor='export function coreOf(s: Exclude<Shape, { kind: "pieces" }>): Core {'
assert s.count(anchor)==1
s=s.replace(anchor,'''export const coreCensus: Record<string, {calls:number; repeated:number; consecutive:number}> = {};
const censusSeen = new WeakSet<object>();
let censusPrevious: object | undefined;
'''+anchor+'''
  const row = coreCensus[s.kind] ??= {calls:0,repeated:0,consecutive:0};
  row.calls++;
  if (censusSeen.has(s)) row.repeated++;
  else censusSeen.add(s);
  if (censusPrevious === s) row.consecutive++;
  censusPrevious = s;
''')
p.write_text(s)
