"""Observe heap pops without editing production source; requires an empty output directory."""
import argparse, hashlib, json, subprocess
from pathlib import Path
assets = Path(__file__).resolve().parent
root = assets.parents[3]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
out = a.out.resolve()
out.mkdir(parents=True, exist_ok=False)
source = root / 'src/route/search.ts'
s = source.read_text()
s = s.replace('  let pops = 0;', '  const states = new Set<number>(), cellsSeen = new Set<number>(); let stale = 0;\n  let pops = 0;', 1)
s = s.replace('    pops++;', '    states.add(nodeState); cellsSeen.add(cellOfState(nodeState));\n    pops++;', 1)
s = s.replace('    if (nodeF - nodeH > gCur + 1e-6) continue;', '    if (nodeF - nodeH > gCur + 1e-6) { stale++; continue; }', 1)
log = 'console.error(JSON.stringify({pops,states:states.size,cells:cellsSeen.size,stale}));\n'
s = s.replace('      return { ok: true, path, rip, pops, aborted };', '      '+log+'      return { ok: true, path, rip, pops, aborted };', 1)
s = s.replace('  return { ok: false, path: [], rip: [], pops, aborted };', '  '+log+'  return { ok: false, path: [], rip: [], pops, aborted };', 1)
(out/'search.ts').write_text(s)
(out/'probe.ts').write_text((assets/'probe.ts').read_text().replace('../../../../src/route/search.ts', './search.ts'))
run = subprocess.run(['taskset','-c','20-25','nice','-n','10','timeout','60','bun',str(out/'probe.ts')], capture_output=True, text=True, check=True)
(out/'results.json').write_text(run.stdout)
(out/'pops.jsonl').write_text(run.stderr)
rows = [json.loads(line) for line in run.stderr.splitlines()]
assert len(rows) == 6
assert all(row == rows[i % 2] for i,row in enumerate(rows))
assert rows[0]['pops'] == 4001 and rows[1]['pops'] == 4437
summary = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'instrumentedSha256':hashlib.sha256(s.encode()).hexdigest(), 'limited': rows[0], 'expanded': rows[1]}
(out/'audit.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary))
