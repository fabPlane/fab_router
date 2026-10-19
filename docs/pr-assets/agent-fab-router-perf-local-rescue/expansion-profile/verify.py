"""Independent root-down remainder membership and byte-identical output replay."""
import ast
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

HERE=Path(__file__).resolve().parent
p=json.loads(gzip.decompress((HERE.parent/'native-profile/production.cpuprofile.gz').read_bytes()))
r=json.loads((HERE/'summary.json').read_text())
source_hashes=json.loads((HERE.parent/'native-profile/source-hashes.json').read_text())
root=HERE.parents[3]
for name in ('src/route/search.ts','src/route/quilt.ts','src/route/passes.ts'):
    assert hashlib.sha256((root/name).read_bytes()).hexdigest()==source_hashes[name], name
nodes={n['id']:n for n in p['nodes']}
children={c for n in p['nodes'] for c in n.get('children',[])}
helpers=set('pop push less swap probe hash leq put gOr parentOf heuristic cellIndex stateOf gxOf gyOf cellOfState layerOfState dirOfState inRegion grow'.split())
selected=set()
def walk(ident,active=False,excluded=False):
    n=nodes[ident]; f=n['callFrame']; name=f['functionName']; path=f['url'].replace('\\','/').split('/src/')[-1]
    if path=='route/search.ts' and name in ('aStar','aStarLayered'):
        active=True; excluded=False
    elif active and (path=='route/clear.ts' or (path=='route/search.ts' and name in helpers)):
        excluded=True
    if active and not excluded:
        selected.add(ident)
    for child in n.get('children',[]):
        walk(child,active,excluded)
for ident in nodes.keys()-children:
    walk(ident)
assert selected==set(r['selected_node_ids'])
assert sum(us for ident,us in zip(p['samples'],p['timeDeltas']) if ident in selected)==r['remainder_us']==7527000
prior=json.loads((HERE.parent/'search-profile/summary.json').read_text())
assert r['remainder_us']==prior['disjoint_us']['search expansion / other']
assert r['search_us']==prior['search_us'] and r['profile_us']==prior['sampled_us']
for name in ('analyze.py','verify.py'):
    ast.parse((HERE/name).read_text())
out=Path(sys.argv[1])
subprocess.run([sys.executable,str(HERE/'analyze.py'),str(out)],check=True,stdout=subprocess.DEVNULL)
for name in ('summary.json','table.md','profile.svg'):
    assert (HERE/name).read_bytes()==(out/name).read_bytes(),name
print('Independent root-down exact membership, historical reconciliation, AST and replay PASS')
