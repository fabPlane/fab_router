"""Create a disposable, exact-source-checked diagnostic tree; never edit engine source in place."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
source, output = map(lambda x: Path(x).resolve(), sys.argv[1:])
if output.exists():
    raise SystemExit('output must not exist')
expected = subprocess.check_output(['git', '-C', str(source), 'show', '69cf598:src/route/passes.ts'])
actual = (source / 'src/route/passes.ts').read_bytes()
if expected != actual:
    raise SystemExit('source is not the measured control')
output.mkdir(parents=True)
for name in ['src', 'spec']:
    shutil.copytree(source / name, output / name)
for name in ['package.json', 'tsconfig.json']:
    shutil.copy2(source / name, output / name)
(output / 'node_modules').symlink_to(source / 'node_modules', target_is_directory=True)
text = actual.decode()
helper = '''
// Diagnostic only: observes existing calls; changes no graph, rule, budget or decision.
type CensusRow = {calls:number; inserted:number; regions:number; coarsened:number;
  searches:number; pops:number; found:number; exhausted:number; resolutions:Record<string,number>};
const census: Record<string,CensusRow> = {};
let activeCensus: CensusRow | undefined;
process.on("exit", () => console.log("GRID_CENSUS " + JSON.stringify(census)));
export function routeConnection(ctx: RouteCtx, conn: Connection): boolean {
  const key = `${conn.net}:${conn.from}:${conn.to}`;
  const row = census[key] ??= {calls:0,inserted:0,regions:0,coarsened:0,searches:0,pops:0,found:0,exhausted:0,resolutions:{}};
  row.calls++;
  const previous = activeCensus;
  activeCensus = row;
  try { const ok = observedRouteConnection(ctx,conn); if(ok) row.inserted++; return ok; }
  finally { activeCensus = previous; }
}
function observedRouteConnection(ctx: RouteCtx, conn: Connection): boolean {'''
needle = 'export function routeConnection(ctx: RouteCtx, conn: Connection): boolean {'
assert text.count(needle) == 1
text = text.replace(needle, helper)
needle = '  return { gx0, gy0, gx1, gy1, step: g };'
assert text.count(needle) == 1
text = text.replace(needle, '''  if(activeCensus) {
    activeCensus.regions++;
    if(g > step) activeCensus.coarsened++;
    const key = `${step}->${g}`;
    activeCensus.resolutions[key] = (activeCensus.resolutions[key] ?? 0) + 1;
  }
''' + needle)
needle = '    if (!res.ok) {'
assert text.count(needle) == 2
text = text.replace(needle, '''    if(activeCensus) {
      activeCensus.searches++; activeCensus.pops += res.pops;
      if(res.ok) activeCensus.found++;
      if(!res.ok && res.pops > Math.min(MAX_POPS, Math.max(''' + 'GRID_MIN_POP' + ''', cells))) activeCensus.exhausted++;
    }
''' + needle,1)
text = text.replace('GRID_MIN_POP','4000')
# Instrument the remaining layered call separately.
pos = text.index('    const res = aStarLayered(space, {')
a, b = text[:pos], text[pos:]
b = b.replace(needle, '''    if(activeCensus) {
      activeCensus.searches++; activeCensus.pops += res.pops;
      if(res.ok) activeCensus.found++;
      if(!res.ok && res.pops > Math.min(MAX_POPS, Math.max(6000, cells))) activeCensus.exhausted++;
    }
''' + needle,1)
text = a+b
(output / 'src/route/passes.ts').write_text(text)
(output / 'census-provenance.json').write_text(json.dumps({
    'control_commit':'69cf598','control_passes_sha256':hashlib.sha256(actual).hexdigest(),
    'instrumented_passes_sha256':hashlib.sha256(text.encode()).hexdigest(),
    'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'purpose':'diagnostic counters only; timings include instrumentation overhead'},indent=2)+'\n')
