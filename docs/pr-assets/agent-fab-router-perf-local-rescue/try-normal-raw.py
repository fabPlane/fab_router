"""Rejected/adoptable status decided from final connectivity, not local legalisation."""
import pathlib,runpy,sys
source,dest=sys.argv[1:]
runpy.run_path(str(pathlib.Path(__file__).with_name('observe-normal-shaping.py')),run_name='__main__')
p=pathlib.Path(dest)/'src/route/passes.ts';s=p.read_text()
needle='  const leg = legaliseTrail(ctx.layout, ctx.lattice, sheet, pulled, profile, ignore, true);'
assert s.count(needle)==1
s=s.replace(needle,needle.replace('const leg','let leg')+'\n  if (!leg.ok) leg = legaliseTrail(ctx.layout, ctx.lattice, sheet, centre, profile, ignore, true);')
p.write_text(s)
