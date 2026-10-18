"""Archive and instrument distance calls without editing the checkout.
Usage: instrument-distance.py SOURCE REVISION NEW_DIRECTORY
Counts dist2 and coreOf calls; first 64 shapes per kind are diagnostic examples.
"""
from pathlib import Path
import io, subprocess, sys, tarfile, hashlib, json
source, revision, output = sys.argv[1:]
root = Path(output)
root.mkdir(exist_ok=False)
archive = subprocess.check_output(['git', '-C', source, 'archive', revision, 'src', 'spec'])
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    tar.extractall(root, filter='data')
p = root / 'src/geom/distance.ts'
s = p.read_text()
needle = 'export function dist2(a: Shape, b: Shape): number {\n'
assert s.count(needle) == 1
s = s.replace(needle, needle + '  if ((globalThis as any).__distanceTrace) (globalThis as any).__distanceTrace.dist2Calls++;\n')
needle = 'export function coreOf(s: Exclude<Shape, { kind: "pieces" }>): Core {\n'
assert s.count(needle) == 1
instrument = """  const trace = (globalThis as any).__distanceTrace;
  if (trace) {
    trace.coreCalls++;
    if (trace.coreCalls % 4096 === 0) {
      const caller = new Error().stack?.split("\\n")[2]?.trim() ?? "unknown";
      trace.sampledCallers[caller] = (trace.sampledCallers[caller] ?? 0) + 1;
    }
    const entry = trace.kinds[s.kind] ?? (trace.kinds[s.kind] = {calls:0,samples:[]});
    entry.calls++;
    if (entry.samples.length < 64) entry.samples.push({shape:JSON.parse(JSON.stringify(s)),stack:new Error().stack});
  }
"""
p.write_text(s.replace(needle, needle + instrument))

(root / 'instrumentation.json').write_text(json.dumps({
    'revision': subprocess.check_output(['git','-C',source,'rev-parse',revision],text=True).strip(),
    'archive_sha256':hashlib.sha256(archive).hexdigest(),
    'instrumented_distance_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
    'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
},indent=2)+'\n')
