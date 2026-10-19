"""Disjoint search profile census; historical samples are not speed measurements."""
import collections
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys
from xml.sax.saxutils import escape

SOURCE = Path(__file__).resolve().parent.parent / 'native-profile/production.cpuprofile.gz'

def analyze(p):
    nodes = {n['id']: n for n in p['nodes']}
    assert len(nodes) == len(p['nodes']), 'duplicate node'
    parents = {}
    for n in nodes.values():
        for child in n.get('children', []):
            assert child in nodes and child not in parents, 'invalid parent'
            parents[child] = n['id']
    stacks = {}
    for ident in nodes:
        chain, seen, cur = [], set(), ident
        while True:
            assert cur not in seen, 'cycle'
            seen.add(cur)
            f = nodes[cur]['callFrame']
            chain.append((f['functionName'], f['url'].replace('\\', '/').split('/src/')[-1]))
            if cur not in parents:
                break
            cur = parents[cur]
        stacks[ident] = chain
    assert len(p['samples']) == len(p['timeDeltas']), 'duration count'
    groups, callers, phases, leaves = (collections.Counter() for _ in range(4))
    outside = 0
    for ident, us in zip(p['samples'], p['timeDeltas']):
        assert isinstance(us, (float, int)) and math.isfinite(us) and us >= 0, 'duration'
        chain = stacks[ident]
        search = next((i for i, (n, f) in enumerate(chain) if f == 'route/search.ts' and n in ('aStar', 'aStarLayered')), None)
        if search is None:
            outside += us
            continue
        # Clearance has precedence so search bookkeeping never includes its geometry subtree.
        if ('hitBlocks', 'route/clear.ts') in chain[:search]:
            group = 'exact clearance subtree'
        elif any(f == 'route/clear.ts' for n, f in chain[:search]):
            group = 'remaining clearance subtree'
        else:
            group = 'search expansion / other'
            for name, path in chain[:search]:
                if path != 'route/search.ts':
                    continue
                if name in ('pop', 'push', 'less', 'swap'):
                    group = 'frontier heap'; break
                if name in ('probe', 'hash', 'leq', 'put', 'gOr', 'parentOf'):
                    group = 'visited state table'; break
                if name in ('heuristic', 'cellIndex', 'stateOf', 'gxOf', 'gyOf', 'cellOfState', 'layerOfState', 'dirOfState', 'inRegion'):
                    group = 'search coordinate / heuristic'; break
                if name == 'grow':
                    group = 'search storage growth'; break
        groups[group] += us
        callers[chain[search][0] + ' / ' + group] += us
        phase = 'recovery' if ('recoverRemaining', 'route/recover-remaining.ts') in chain else 'outside recovery'
        phases[phase + ' / ' + group] += us
        leaves[' | '.join(chain[0])] += us
    total = sum(p['timeDeltas'])
    assert outside + sum(groups.values()) == total
    assert sum(callers.values()) == sum(phases.values()) == sum(leaves.values()) == sum(groups.values())
    return dict(sample_count=len(p['samples']), sampled_us=total, outside_search_us=outside,
                search_us=sum(groups.values()), disjoint_us=dict(sorted(groups.items())),
                caller_disjoint_us=dict(sorted(callers.items())), phase_disjoint_us=dict(sorted(phases.items())),
                leaf_us=dict(sorted(leaves.items())))

def controls(p):
    mutations = [lambda q:q['timeDeltas'].pop(), lambda q:q['samples'].__setitem__(0,-1),
                 lambda q:q['nodes'].append(copy.deepcopy(q['nodes'][0])),
                 lambda q:q['timeDeltas'].__setitem__(0,-1), lambda q:q['timeDeltas'].__setitem__(0,float('nan')),
                 lambda q:q['nodes'][0].setdefault('children',[]).append(-1),
                 lambda q:q['nodes'][0].setdefault('children',[]).append(q['nodes'][0]['id'])]
    for mutate in mutations:
        q=copy.deepcopy(p); mutate(q)
        try: analyze(q)
        except (AssertionError,KeyError): pass
        else: raise AssertionError('corruption accepted')
    def node(i,n,f,children=()):
        return dict(id=i,callFrame=dict(functionName=n,url='/src/'+f),children=list(children))
    q=dict(nodes=[node(1,'recoverRemaining','route/recover-remaining.ts',[2]),
                  node(2,'aStarLayered','route/search.ts',[3,4,6]),
                  node(3,'pop','route/search.ts'),node(4,'hitBlocks','route/clear.ts',[5]),
                  node(5,'probe','route/search.ts'),node(6,'probe','unrelated.ts')],
           samples=[1,2,3,4,5,6],timeDeltas=[1,2,3,4,5,6])
    r=analyze(q)
    assert r['outside_search_us']==1 and r['search_us']==20
    assert r['disjoint_us']=={'exact clearance subtree':9,'frontier heap':3,'search expansion / other':8}
    assert all(k.startswith('recovery / ') for k in r['phase_disjoint_us'])
    q['nodes'][5]['callFrame']['url']='/src/route/search.ts'
    assert analyze(q)['disjoint_us']['visited state table']==6
    q['nodes'].append(node(7,'aStar','route/search.ts',[3]))
    q['nodes'][1]['children'].remove(3)
    r=analyze(q)
    assert r['caller_disjoint_us']['aStar / frontier heap']==3
    assert r['phase_disjoint_us']['outside recovery / frontier heap']==3
    return len(mutations)

def main():
    raw=SOURCE.read_bytes(); p=json.loads(gzip.decompress(raw)); r=analyze(p)
    r['corruption_controls_rejected']=controls(p)
    r['source_gzip_sha256']=hashlib.sha256(raw).hexdigest()
    out=Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=False)
    (out/'summary.json').write_text(json.dumps(r,indent=2)+'\n')
    rows=['| Disjoint search group | Sampled seconds | Search share |','|---|---:|---:|']
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560"><rect width="1400" height="560" fill="white"/><g font-family="sans-serif" fill="#18313c"><text x="25" y="35" font-size="24">Search expansion: disjoint historical CPU samples</text><text x="25" y="68" font-size="17">Complete Aquarius replay; sampled stacks are not call counts or predicted speedups</text>']
    for i,(name,us) in enumerate(sorted(r['disjoint_us'].items(),key=lambda x:-x[1])):
        share=us/r['search_us']; rows.append(f'| {name} | {us/1e6:.6f} | {share:.2%} |')
        y=115+i*54
        svg.append(f'<text x="25" y="{y}" font-size="18">{escape(name)}</text><rect x="390" y="{y-18}" width="{share*800:.3f}" height="27" fill="#287b96"/><text x="1230" y="{y}" font-size="18">{us/1e6:.3f}s</text>')
    svg.append(f'<text x="25" y="515" font-size="17">Search {r["search_us"]/1e6:.6f}s / full profile {r["sampled_us"]/1e6:.6f}s; every sample assigned once.</text></g></svg>\n')
    (out/'table.md').write_text('\n'.join(rows)+'\n'); (out/'profile.svg').write_text(''.join(svg))
    print(json.dumps({k:v for k,v in r.items() if k not in ('leaf_us','caller_disjoint_us','phase_disjoint_us')},indent=2))

if __name__=='__main__': main()
