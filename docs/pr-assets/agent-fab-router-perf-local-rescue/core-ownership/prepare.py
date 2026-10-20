from pathlib import Path
import subprocess,sys,tarfile,io,json,hashlib
root=Path(sys.argv[1]); out=Path(sys.argv[2]); out.mkdir()
blob=subprocess.check_output(['git','-C',str(root),'archive','HEAD','src','spec','package.json','tsconfig.json','bun.lock'])
with tarfile.open(fileobj=io.BytesIO(blob)) as t: t.extractall(out,filter='data')
(out/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
hashes={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for d in ['src','spec'] for p in sorted((out/d).rglob('*')) if p.is_file()}
(out/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
p=out/'src/geom/distance.ts';s=p.read_text();anchor='export function coreOf(s: Exclude<Shape, { kind: "pieces" }>): Core {'
assert s.count(anchor)==1
instrument='''
interface OwnedRecord { row: OwnershipRow; r: number; pts: {x:number;y:number}[]; calls: number }
interface OwnershipRow { registered:number; calls:number; repeated:number; changed:number }
export const ownershipCensus: Record<string,OwnershipRow> = {};
export const ownershipTotals = {calls:0, unowned:0};
const ownedShapes = new WeakMap<object,OwnedRecord>();
export function registerOwnedShape(s: Shape, cat: string): void {
  if (s.kind === "pieces") { for (const p of s.parts) registerOwnedShape(p,cat); return; }
  if (ownedShapes.has(s)) throw Error("shape registered twice");
  const row = ownershipCensus[cat+":"+s.kind] ??= {registered:0,calls:0,repeated:0,changed:0};
  row.registered++;
  const c = originalCoreOf(s);
  ownedShapes.set(s,{row,r:c.r,pts:c.pts.map(p=>({x:p.x,y:p.y})),calls:0});
}
export function coreOf(s: Exclude<Shape, { kind: "pieces" }>): Core {
  const c = originalCoreOf(s);
  ownershipTotals.calls++;
  const rec = ownedShapes.get(s);
  if (!rec) { ownershipTotals.unowned++; return c; }
  rec.row.calls++; if(rec.calls++ > 0)rec.row.repeated++;
  let changed = c.r !== rec.r || c.pts.length !== rec.pts.length;
  if (!changed) for(let i=0;i<c.pts.length;i++) {
    if(c.pts[i]!.x !== rec.pts[i]!.x || c.pts[i]!.y !== rec.pts[i]!.y) {changed=true;break;}
  }
  if(changed)rec.row.changed++;
  return c;
}
'''
s=s.replace(anchor,instrument+'\nfunction originalCoreOf(s: Exclude<Shape, { kind: "pieces" }>): Core {');p.write_text(s)
p=out/'src/lattice/grid.ts';s=p.read_text();anchor='    entry.cache.set(ck, shapes);';assert s.count(anchor)==1
s='import { registerOwnedShape } from "../geom/distance.ts";\n'+s.replace(anchor,'    for (const shape of shapes) registerOwnedShape(shape,entry.cat);\n'+anchor);p.write_text(s)
