"""Split historical expansion samples; does not measure speed or call counts."""
import collections
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('prior', HERE.parent / 'search-profile/analyze.py')
prior = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prior)
HELPERS = set('pop push less swap probe hash leq put gOr parentOf heuristic cellIndex stateOf gxOf gyOf cellOfState layerOfState dirOfState inRegion grow'.split())

def frame(n):
    f = n['callFrame']
    return (f['functionName'], f['url'].replace('\\', '/').split('/src/')[-1], f['lineNumber'])

def analyze(p):
    baseline = prior.analyze(p)  # Validate the complete profile before selecting any subset.
    nodes = {n['id']: n for n in p['nodes']}
    parents = {c:n['id'] for n in p['nodes'] for c in n.get('children', [])}
    selected, groups, stacks, callers = {}, collections.Counter(), collections.Counter(), collections.Counter()
    for ident in nodes:
        chain, cur = [], ident
        while True:
            f = frame(nodes[cur]); chain.append(f)
            if f[1] == 'route/search.ts' and f[0] in ('aStar', 'aStarLayered'):
                break
            if cur not in parents:
                chain = []; break
            cur = parents[cur]
        if not chain:
            continue
        below = chain[:-1]
        if any(path == 'route/clear.ts' or (path == 'route/search.ts' and name in HELPERS) for name,path,line in below):
            continue
        group = 'other expansion descendants'
        if not below:
            group = 'search self (includes inlined work)'
        elif any(path == 'route/quilt.ts' and name == 'isFree' for name,path,line in below):
            group = 'quilt availability outside clearance'
        else:
            # Nearest callback to the search, never sum nested inclusive frames.
            for name,path,line in reversed(below):
                if path == 'route/passes.ts' and name in ('edgeCost', 'viaMove'):
                    group = name + ' outside clearance'; break
                if name == 'pointOf' and path in ('route/passes.ts', 'route/quilt.ts'):
                    group = 'point construction outside clearance'; break
        selected[ident] = (group, chain)
    for ident, us in zip(p['samples'], p['timeDeltas']):
        if ident not in selected:
            continue
        group, chain = selected[ident]
        groups[group] += us
        callers[chain[-1][0] + ' / ' + group] += us
        stacks[' <- '.join(f'{path}:{line+1}::{name or "(anonymous)"}' for name,path,line in chain)] += us
    total = sum(groups.values())
    assert total == baseline['disjoint_us'].get('search expansion / other', 0)
    assert total == sum(callers.values()) == sum(stacks.values())
    return dict(remainder_us=total, search_us=baseline['search_us'], profile_us=baseline['sampled_us'],
                groups_us=dict(sorted(groups.items())), caller_groups_us=dict(sorted(callers.items())),
                stacks_us=dict(sorted(stacks.items())), selected_node_ids=sorted(selected))

def controls():
    def node(i,name,path,children=()):
        return dict(id=i,callFrame=dict(functionName=name,url='/src/'+path,lineNumber=0),children=list(children))
    p=dict(nodes=[node(1,'aStar','route/search.ts',[2,4,5,6,7]),
        node(2,'isFree','route/quilt.ts',[3]),node(3,'state','route/quilt.ts'),
        node(4,'edgeCost','route/passes.ts',[8]),node(5,'viaMove','route/passes.ts'),
        node(6,'pointOf','route/quilt.ts'),node(7,'isFree','unrelated.ts'),
        node(8,'hitBlocks','route/clear.ts',[9]),node(9,'state','route/quilt.ts')],
        samples=list(range(1,10)),timeDeltas=list(range(1,10)))
    r=analyze(p)
    assert r['remainder_us']==28
    assert r['groups_us']=={'search self (includes inlined work)':1,'quilt availability outside clearance':5,
        'edgeCost outside clearance':4,'viaMove outside clearance':5,'point construction outside clearance':6,'other expansion descendants':7}
    p['nodes'][6]['callFrame']['functionName']='probe'; p['nodes'][6]['callFrame']['url']='/src/route/search.ts'
    assert analyze(p)['remainder_us']==21
    return 'hand-counted nested clearance, qualified names, callbacks, helper exclusion PASS'

def main():
    raw=(HERE.parent/'native-profile/production.cpuprofile.gz').read_bytes()
    p=json.loads(gzip.decompress(raw)); r=analyze(p)
    r['controls']=controls(); r['prior_corruptions_rejected']=prior.controls(p)
    r['source_gzip_sha256']=hashlib.sha256(raw).hexdigest()
    out=Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=False)
    (out/'summary.json').write_text(json.dumps(r,indent=2)+'\n')
    rows=['| Expansion remainder group | Sampled seconds | Remainder share |','|---|---:|---:|']
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="510"><rect width="1400" height="510" fill="white"/><g font-family="sans-serif" fill="#18313c"><text x="25" y="35" font-size="24">Expansion remainder: historical sampled stacks</text><text x="25" y="70" font-size="17">Clearance, frontier, visited and coordinate helpers excluded; no speedup claim</text>']
    for i,(name,us) in enumerate(sorted(r['groups_us'].items(),key=lambda v:-v[1])):
        share=us/r['remainder_us']; rows.append(f'| {name} | {us/1e6:.6f} | {share:.2%} |')
        y=120+i*52
        svg.append(f'<text x="25" y="{y}" font-size="18">{escape(name)}</text><rect x="475" y="{y-19}" width="{share*650:.3f}" height="28" fill="#287b96"/><text x="1190" y="{y}" font-size="18">{us/1e6:.6f}s</text>')
    svg.append(f'<text x="25" y="465" font-size="17">Every remainder sample counted once: {r["remainder_us"]/1e6:.6f}s of {r["profile_us"]/1e6:.6f}s full profile.</text></g></svg>\n')
    (out/'table.md').write_text('\n'.join(rows)+'\n'); (out/'profile.svg').write_text(''.join(svg))
    print(json.dumps(r['groups_us'],indent=2))
if __name__=='__main__': main()
