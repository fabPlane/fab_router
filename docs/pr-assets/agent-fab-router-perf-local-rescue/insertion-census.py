"""Extend the unchanged-control search census with exact insertion-stage observations."""
import runpy,sys
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('grid-census.py')),run_name='__main__')
p=Path(sys.argv[2])/'src/route/passes.ts'
s=p.read_text()
needle='resolutions:Record<string,number>'
s=s.replace(needle,'stages:Record<string,number>; '+needle)
s=s.replace('exhausted:0,resolutions:{}','exhausted:0,stages:{},resolutions:{}')
s=s.replace('let activeCensus:', 'function stage(name:string):void { if(activeCensus) activeCensus.stages[name]=(activeCensus.stages[name]??0)+1; }\nlet activeCensus:')
def change(a,b,n=1):
 global s
 assert s.count(a)==n,(a,s.count(a))
 s=s.replace(a,b)
change('  if (!leg.ok) return false;', '  if (!leg.ok) { stage("trail-legalise-rejected"); return false; }')
change('  if (pieces.length === 0) return false;', '  if (pieces.length === 0) { stage("trail-empty"); return false; }')
change('  const los = (a: Pt, b: Pt): boolean =>', '  stage("trail-attempt");\n  const los = (a: Pt, b: Pt): boolean =>')
change('  for (const piece of pieces) {','  stage("trail-legalised");\n  for (const piece of pieces) {')
change('if (!cand || !barrelFits(ctx.layout, ctx.lattice, b.at, cand, profile, ignore).ok) { ctx.journal.rewind(mark); return false; }','if (!cand || !barrelFits(ctx.layout, ctx.lattice, b.at, cand, profile, ignore).ok) { stage("layered-barrel-rejected"); ctx.journal.rewind(mark); return false; }')
change('if (!insertTrail(ctx, net, leg.sheet, leg.pts, profile, ignore)) { ctx.journal.rewind(mark); return false; }','if (!insertTrail(ctx, net, leg.sheet, leg.pts, profile, ignore)) { stage("layered-leg-rejected"); ctx.journal.rewind(mark); return false; }')
p.write_text(s)

import hashlib,json
provenance=Path(sys.argv[2])/'census-provenance.json'
v=json.loads(provenance.read_text())
v['instrumented_passes_sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
v['insertion_generator_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
provenance.write_text(json.dumps(v,indent=2)+'\n')
