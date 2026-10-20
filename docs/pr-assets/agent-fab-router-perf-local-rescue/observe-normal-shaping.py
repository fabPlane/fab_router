"""Create an observer-only disposable checkout; never changes insertion decisions."""
import hashlib,json,pathlib,subprocess,sys,tarfile,io
source=pathlib.Path(sys.argv[1]).resolve(); dest=pathlib.Path(sys.argv[2]).resolve()
if dest.exists(): raise SystemExit('destination exists')
p=source/'src/route/passes.ts'; original=p.read_bytes()
expected=subprocess.check_output(['git','-C',str(source),'show','69cf598:src/route/passes.ts'])
if original!=expected: raise SystemExit('unexpected production source')
data=subprocess.check_output(['git','-C',str(source),'archive','HEAD'])
dest.mkdir(parents=True)
with tarfile.open(fileobj=io.BytesIO(data)) as archive: archive.extractall(dest,filter='data')
(dest/'node_modules').symlink_to(source/'node_modules',target_is_directory=True)
s=original.decode(); needle='  if (!leg.ok) return false;\n  const pieces = trackPieces(leg.pts, leg.widths);'
assert s.count(needle)==1
observation='''  if (!leg.ok) {
    const raw = legaliseTrail(ctx.layout, ctx.lattice, sheet, centre, profile, ignore, true);
    let perLeg = pulled.length > 1;
    for (let i=1;i<pulled.length;i++) {
      const a=pulled[i-1]!, b=pulled[i]!;
      if(a.x===b.x && a.y===b.y) continue;
      if(!legaliseTrail(ctx.layout,ctx.lattice,sheet,[a,b],profile,ignore,false).ok) perLeg=false;
    }
    console.log('NORMAL_SHAPE '+JSON.stringify({net,sheet,centre,pulled,rawLegal:raw.ok,perLegLegal:perLeg}));
  }
'''
s=s.replace(needle,observation+needle); (dest/'src/route/passes.ts').write_text(s)
print(json.dumps({'base_sha256':hashlib.sha256(original).hexdigest(),'observed_sha256':hashlib.sha256(s.encode()).hexdigest(),'head':subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()}))
