"""Add observer-only transaction/net attribution and first-blocked shaped segments."""
import hashlib,json,re,runpy,sys
from pathlib import Path
assets=Path(__file__).resolve().parent
import subprocess
source=Path(sys.argv[1]).resolve()
for name in ['passes','legalise']:
 expected=subprocess.check_output(['git','-C',str(source),'show',f'69cf598:src/route/{name}.ts'])
 if (source/f'src/route/{name}.ts').read_bytes()!=expected:raise SystemExit('source is not the measured control')
runpy.run_path(str(assets/'insertion-census.py'),run_name='__main__')
root=Path(sys.argv[2]);p=root/'src/route/passes.ts';s=p.read_text()
keys=[]
for path in sorted(assets.glob('residual-*.json')):
    value=json.loads(path.read_text())
    if isinstance(value,dict): keys.extend(c['key'] for c in value.get('connections',[]))
s=s.replace('import { legaliseTrail, trackPieces }','import { diagnosticBlocked, legaliseTrail, trackPieces }')
helper='''
// Diagnostic synchronous call tree only; success means trial return, not retained copper.
const observedKeys = new Set(KEYS);
let activeKey = "";
let trialSequence = 0;
type Trial = {id:number; parent:number|null; owner:string; kind:string; net:number|null;
  ok?:boolean; sheet?:number; centre?:readonly Pt[]; blocked?:unknown[]};
const trials: Trial[] = [];
const trialStack: Trial[] = [];
process.on("exit", () => console.log("TRIAL_TRACE " + JSON.stringify(trials)));
function traceTrial(kind:string,net:number|null,run:()=>boolean,detail?:{sheet:number;centre:readonly Pt[]}):boolean {
  if(!observedKeys.has(activeKey)) return run();
  const trial:Trial={id:++trialSequence,parent:trialStack.at(-1)?.id??null,owner:activeKey,kind,net,...detail};
  trials.push(trial); trialStack.push(trial);
  if(kind==="insertTrail") diagnosticBlocked.length=0;
  try { const ok=run();trial.ok=ok;return ok; }
  finally { if(kind==="insertTrail") trial.blocked=diagnosticBlocked.slice();trialStack.pop(); }
}
'''.replace('KEYS',json.dumps(keys))
s=s.replace('// Diagnostic only:',helper+'\n// Diagnostic only:',1)
s=s.replace('  const previous = activeCensus;','  const previousKey=activeKey;activeKey=key;\n  const previous = activeCensus;')
s=s.replace('finally { activeCensus = previous; }','finally { activeCensus = previous; activeKey=previousKey; }')
s=s.replace('const ok = observedRouteConnection(ctx,conn);','const ok = traceTrial("routeConnection",conn.net,()=>observedRouteConnection(ctx,conn));')
# Wrap actual call boundaries; no call reordering, extra geometry queries or rule changes.
args={
 'insertTrail':'ctx,net,sheet,centre,profile,ignore',
 'insertLayeredTrail':'ctx,net,path,usable,to,profile,ignore',
 'fastProbe':'ctx,net,sheet,from,to,profile,ignore',
 'tryShoveTrail':'ctx,net,sheet,centre,profile,ignore',
 'tryRouteOnSheet':'ctx,net,sheet,from,to,profile,ignore,deadline,soft,corridor',
 'tryRouteLayered':'ctx,net,from,to,fromUsable,toUsable,profile,ignore,deadline,soft,corridor',
 'tryRouteViaPoints':'ctx,net,from,to,fromUsable,toUsable,profile,ignore,deadline,soft',
 'tryRouteViaJog':'ctx,net,from,to,sheet,profile,ignore,deadline,soft',
 'tryPlaneVia':'ctx,net,sigPt,sigUsable,planeSheet,profile,ignore',
 'tryShoveRoute':'ctx,net,sheet,from,to,profile,ignore,deadline',
}
for name,call in args.items():
    pattern=r'function '+name+r'\([\s\S]*?\): boolean \{'
    match=re.search(pattern,s);assert match,name
    signature=match.group();original=signature.replace(name,'observed_'+name,1)
    detail=',{sheet,centre}' if name=='insertTrail' else ''
    wrapper=signature+'\n  return traceTrial('+json.dumps(name)+',net,()=>observed_'+name+'('+call+')'+detail+');\n}\n'+original
    s=s[:match.start()]+wrapper+s[match.end():]
p.write_text(s)
p=root/'src/route/legalise.ts';s=p.read_text()
s=s.replace('export interface LegaliseResult {','export const diagnosticBlocked: unknown[] = [];\n\nexport interface LegaliseResult {',1)
old='    if (sweepClear(layout, lattice, sheet, seg, profile, ignore, profile.width).ok) continue;'
assert s.count(old)==1
s=s.replace(old,'    const observedFull = sweepClear(layout, lattice, sheet, seg, profile, ignore, profile.width);\n    if (observedFull.ok) continue;')
old='    return { ok: false, pts: [], widths: [] };'
assert s.count(old)==1
s=s.replace(old,'''    diagnosticBlocked.push({sheet, index:i, legs:n, seg, width:profile.width,
      neckWidth:profile.neckWidth, angle:profile.angleMode, blocking:observedFull.blocking.slice()});
'''+old)
p.write_text(s)
provenance=root/'census-provenance.json';v=json.loads(provenance.read_text())
v['trial_generator_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
for name in ['passes','legalise']:
 v['instrumented_'+name+'_sha256']=hashlib.sha256((root/f'src/route/{name}.ts').read_bytes()).hexdigest()
provenance.write_text(json.dumps(v,indent=2)+'\n')
