"""Partition historical hitBlocks samples, preserving calling contexts and remainders."""
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
RULES = {
    ('segsIntersect', 'geom/predicates.ts'): 'segment intersection',
    ('onSeg', 'geom/predicates.ts'): 'segment intersection',
    ('dist2PtSeg', 'geom/distance.ts'): 'point-segment distance',
    ('dist2SegSeg', 'geom/distance.ts'): 'segment-segment remainder',
    ('coreOf', 'geom/distance.ts'): 'core conversion',
    ('dist2PtPoly', 'geom/distance.ts'): 'polygon distance remainder',
    ('dist2SegPoly', 'geom/distance.ts'): 'polygon distance remainder',
    ('dist2PolyPoly', 'geom/distance.ts'): 'polygon distance remainder',
    ('pointInConvex', 'geom/predicates.ts'): 'polygon containment',
    ('shapesOf', 'lattice/grid.ts'): 'obstacle shapes lookup',
    ('itemOf', 'lattice/grid.ts'): 'obstacle item lookup',
}

def frame(node):
    f = node['callFrame']
    return f['functionName'], f['url'].replace('\\', '/').split('/src/')[-1]

def analyze(p):
    nodes = {n['id']: n for n in p['nodes']}
    assert len(nodes) == len(p['nodes']), 'duplicate node'
    parents = {}
    for n in nodes.values():
        for child in n.get('children', []):
            assert child in nodes and child not in parents, 'invalid child/parent'
            parents[child] = n['id']
    stacks = {}
    for ident in nodes:
        chain, seen, cur = [], set(), ident
        while True:
            assert cur not in seen, 'cycle'
            seen.add(cur)
            chain.append(frame(nodes[cur]))
            if cur not in parents:
                break
            cur = parents[cur]
        stacks[ident] = chain
    samples, deltas = p['samples'], p['timeDeltas']
    assert len(samples) == len(deltas), 'duration count'
    groups, scopes, recovery, self_us = (collections.Counter() for _ in range(4))
    outside = 0
    for ident, delta in zip(samples, deltas):
        assert isinstance(delta, (int, float)) and math.isfinite(delta) and delta >= 0, 'duration'
        chain = stacks[ident]
        hit = next((i for i, f in enumerate(chain) if f == ('hitBlocks', 'route/clear.ts')), None)
        if hit is None:
            outside += delta
            continue
        # Leaf-first nearest matching ancestor; every hitBlocks sample assigned once.
        group = next((RULES[f] for f in chain[:hit] if f in RULES), 'candidate dispatch / other')
        groups[group] += delta
        scope = next((name for name, path in chain[hit+1:]
                      if path == 'route/clear.ts' and name in ('sweepClear', 'barrelFits')), 'other caller')
        scopes[scope + ' / ' + group] += delta
        phase = 'recovery' if ('recoverRemaining', 'route/recover-remaining.ts') in chain else 'outside recovery'
        recovery[phase + ' / ' + group] += delta
        self_us[' | '.join(chain[0])] += delta
    total = sum(deltas)
    assert outside + sum(groups.values()) == total
    assert sum(scopes.values()) == sum(recovery.values()) == sum(self_us.values()) == sum(groups.values())
    return {'sample_count': len(samples), 'sampled_us': total,
            'outside_hitBlocks_us': outside, 'hitBlocks_us': sum(groups.values()),
            'disjoint_us': dict(sorted(groups.items())),
            'caller_disjoint_us': dict(sorted(scopes.items())),
            'phase_disjoint_us': dict(sorted(recovery.items())),
            'self_us': dict(sorted(self_us.items()))}

def controls(p):
    mutations = [lambda q: q['timeDeltas'].pop(),
                 lambda q: q['samples'].__setitem__(0, -999),
                 lambda q: q['nodes'][0].setdefault('children', []).append(q['nodes'][0]['id']),
                 lambda q: q['nodes'].append(copy.deepcopy(q['nodes'][0])),
                 lambda q: q['timeDeltas'].__setitem__(0, -1),
                 lambda q: q['timeDeltas'].__setitem__(0, float('nan')),
                 lambda q: q['nodes'][0].setdefault('children', []).append(-999)]
    for mutate in mutations:
        q = copy.deepcopy(p); mutate(q)
        try:
            analyze(q)
        except (AssertionError, KeyError):
            pass
        else:
            raise AssertionError('corruption accepted')
    # Hand-counted nested frames prove nearest-ancestor, scope and remainder semantics.
    def node(i, name, path, children=()):
        return {'id': i, 'callFrame': {'functionName': name, 'url': '/src/' + path}, 'children': list(children)}
    q = {'nodes': [node(1, 'sweepClear', 'route/clear.ts', [2]),
                   node(2, 'hitBlocks', 'route/clear.ts', [3, 5]),
                   node(3, 'dist2SegSeg', 'geom/distance.ts', [4]),
                   node(4, 'segsIntersect', 'geom/predicates.ts'),
                   node(5, 'coreOf', 'geom/distance.ts')],
         'samples': [1, 2, 3, 4, 5], 'timeDeltas': [1, 2, 3, 4, 5]}
    r = analyze(q)
    assert r['outside_hitBlocks_us'] == 1 and r['hitBlocks_us'] == 14
    assert r['disjoint_us'] == {'candidate dispatch / other': 2, 'core conversion': 5,
                                'segment intersection': 4, 'segment-segment remainder': 3}
    assert r['caller_disjoint_us']['sweepClear / segment intersection'] == 4
    # Same function name at another path must not be recognized as a geometric predicate.
    q['nodes'][3]['callFrame']['url'] = '/src/unrelated.ts'
    r = analyze(q)
    assert r['disjoint_us']['segment-segment remainder'] == 7
    assert 'segment intersection' not in r['disjoint_us']
    q['nodes'].append(node(6, 'recoverRemaining', 'route/recover-remaining.ts', [1]))
    r = analyze(q)
    assert sum(r['phase_disjoint_us'].values()) == 14
    assert all(k.startswith('recovery / ') for k in r['phase_disjoint_us'])
    return len(mutations)

def main():
    raw = SOURCE.read_bytes()
    p = json.loads(gzip.decompress(raw))
    result = analyze(p)
    result['corruption_controls_rejected'] = controls(p)
    result['source_gzip_sha256'] = hashlib.sha256(raw).hexdigest()
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=False)
    (out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    rows = ['| Disjoint hitBlocks group | Sampled seconds | Share of hitBlocks |', '|---|---:|---:|']
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620"><rect width="1200" height="620" fill="white"/><g font-family="sans-serif" fill="#18313c"><text x="25" y="35" font-size="23">Exact obstacle checks: disjoint historical CPU samples</text><text x="25" y="66" font-size="16">One complete Aquarius replay; samples are not call counts or benchmark speedups</text>']
    for i, (name, us) in enumerate(sorted(result['disjoint_us'].items(), key=lambda x: -x[1])):
        share = us / result['hitBlocks_us']
        rows.append(f'| {name} | {us/1e6:.6f} | {share:.2%} |')
        y = 110 + i * 48
        svg.append(f'<text x="25" y="{y}" font-size="17">{escape(name)}</text><rect x="340" y="{y-18}" width="{share*1500:.3f}" height="26" fill="#287b96"/><text x="1020" y="{y}" font-size="17">{us/1e6:.3f}s</text>')
    svg.append(f'<text x="25" y="580" font-size="16">hitBlocks: {result["hitBlocks_us"]/1e6:.6f}s; entire profile: {result["sampled_us"]/1e6:.6f}s. Each sample assigned once.</text></g></svg>\n')
    (out / 'table.md').write_text('\n'.join(rows) + '\n')
    (out / 'profile.svg').write_text(''.join(svg))
    print(json.dumps({k:v for k,v in result.items() if k not in ('self_us','caller_disjoint_us','phase_disjoint_us')}, indent=2))

if __name__ == '__main__':
    main()
