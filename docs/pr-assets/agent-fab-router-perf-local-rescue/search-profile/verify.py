"""Independent root-down search-membership reconciliation plus generated-file replay."""
import ast
import gzip
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ast.parse((HERE / 'analyze.py').read_text())
p = json.loads(gzip.decompress((HERE.parent / 'native-profile/production.cpuprofile.gz').read_bytes()))
nodes = {n['id']: n for n in p['nodes']}
parents = {j for n in nodes.values() for j in n.get('children', [])}
selected = set()
def walk(ident, active=False):
    n = nodes[ident]; f = n['callFrame']
    active = active or (f['url'].endswith('/src/route/search.ts') and f['functionName'] in ('aStar', 'aStarLayered'))
    if active:
        selected.add(ident)
    for child in n.get('children', []):
        walk(child, active)
for ident in nodes.keys() - parents:
    walk(ident)
r = json.loads((HERE / 'summary.json').read_text())
assert sum(us for ident, us in zip(p['samples'], p['timeDeltas']) if ident in selected) == r['search_us']
# Independent exact-clearance historical partition is a whole-profile superset.
exact = json.loads((HERE.parent / 'exact-profile/summary.json').read_text())
assert r['disjoint_us']['exact clearance subtree'] <= exact['hitBlocks_us']
out = Path(sys.argv[1])
subprocess.run([sys.executable, str(HERE / 'analyze.py'), str(out)], check=True, stdout=subprocess.DEVNULL)
for name in ('summary.json', 'table.md', 'profile.svg'):
    assert (HERE / name).read_bytes() == (out / name).read_bytes(), name
print('Independent search membership, historical subset, AST and byte-identical replay PASS')
