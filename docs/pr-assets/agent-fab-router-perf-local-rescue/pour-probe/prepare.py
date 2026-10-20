"""Create disposable sources; never edit the measured engine checkout."""
import hashlib,json,shutil,sys
from pathlib import Path
root,out=map(lambda s:Path(s).resolve(),sys.argv[1:])
if out.exists(): raise SystemExit('Output exists')
out.mkdir()
manifest={}
for mode in ('centroid','vertex'):
 dest=out/mode;dest.mkdir()
 for name in ('src','spec'): shutil.copytree(root/name,dest/name)
 for name in ('package.json','tsconfig.json'): shutil.copy2(root/name,dest/name)
 (dest/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
 path=dest/'src/route/recovery-endpoint.ts';original=path.read_text()
 needle=' return undefined;'
 assert original.count(needle)==1
 point="{x:Math.round(pour.outline.reduce((s,p)=>s+p.x,0)/pour.outline.length),y:Math.round(pour.outline.reduce((s,p)=>s+p.y,0)/pour.outline.length)}" if mode=='centroid' else '{...pour.outline[0]!}'
 patch=" const pour=layout.pours.find(p=>p.id===id&&p.net===net&&p.outline.length>=3);\n if(pour)return {id:pour.id,at:"+point+",sheets:[pour.sheet]};\n"
 path.write_text(original.replace(needle,patch+needle))
 hashes=lambda base:{str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest() for top in ('src','spec') for p in sorted((base/top).rglob('*')) if p.is_file()}
 before,after=hashes(root),hashes(dest)
 changed=[p for p in before if before[p]!=after[p]]
 assert changed==['src/route/recovery-endpoint.ts'],changed
 manifest[mode]={'changed':changed,'source':after,'baseline':before,'patch':patch}
(out/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
