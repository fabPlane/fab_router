"""Disjoint CPU sample attribution; never interprets samples as call counts."""
import collections
import gzip
import hashlib
import json
from pathlib import Path
import sys

SOURCE = Path(__file__).resolve().parent.parent / 'native-profile/production.cpuprofile.gz'

def analyze(p):
    nodes = {n['id']: n for n in p['nodes']}
    assert len(nodes) == len(p['nodes'])
    parents = {}
    for n in nodes.values():
        for child in n.get('children', []):
            assert child in nodes and child not in parents
            parents[child] = n['id']
    stacks = {}
    for ident in nodes:
        chain, seen, cur = [], set(), ident
        while True:
            assert cur not in seen, 'cyclic profile'
            seen.add(cur)
            frame = nodes[cur]['callFrame']
            chain.append((frame['functionName'], frame['url'].replace('\\', '/')))
            if cur not in parents:
                break
            cur = parents[cur]
        stacks[ident] = chain
    samples, deltas = p['samples'], p['timeDeltas']
    assert len(samples) == len(deltas)
    groups = collections.Counter()
    callers = collections.Counter()
    for ident, delta in zip(samples, deltas):
        assert delta >= 0
        chain = stacks[ident]
        sweep = next((i for i, (name, url) in enumerate(chain)
                      if name == 'sweepClear' and url.endswith('/src/route/clear.ts')), None)
        if sweep is None:
            group = 'outside sweepClear'
        else:
            below = chain[:sweep]
            # First matching ancestor from the leaf assigns each sample ONCE.
            group = 'sweepClear body / other descendants'
            for name, url in below:
                if name == 'withinRim' and url.endswith('/src/geom/onboard.ts'):
                    group = 'boundary containment'; break
                if name == 'collect' and url.endswith('/src/lattice/grid.ts'):
                    group = 'lattice collection'; break
                if name == 'hitBlocks' and url.endswith('/src/route/clear.ts'):
                    group = 'candidate exact checks'; break
        groups[group] += delta
        for i, (name, url) in enumerate(chain):
            if name == 'collect' and url.endswith('/src/lattice/grid.ts'):
                caller = chain[i+1] if i+1 < len(chain) else ('root', '')
                callers[caller[0] + ' ' + caller[1].split('/src/')[-1]] += delta
                break
    assert sum(groups.values()) == sum(deltas)
    return {'sample_count': len(samples), 'sampled_us': sum(deltas),
            'disjoint_us': dict(sorted(groups.items())),
            'collection_immediate_callers_us': dict(sorted(callers.items()))}

def main():
    raw = SOURCE.read_bytes()
    p = json.loads(gzip.decompress(raw))
    result = analyze(p)
    # Invalid graph, missing duration and unknown sampled ID must all fail.
    for mutate in (lambda q: q['timeDeltas'].pop(),
                   lambda q: q['samples'].__setitem__(0, -999),
                   lambda q: q['nodes'][0].setdefault('children', []).append(q['nodes'][0]['id'])):
        q = json.loads(json.dumps(p)); mutate(q)
        try:
            analyze(q)
        except (AssertionError, KeyError):
            pass
        else:
            raise AssertionError('corruption accepted')
    result['source_gzip_sha256'] = hashlib.sha256(raw).hexdigest()
    result['corruption_controls_rejected'] = 3
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    (out/'summary.json').write_text(json.dumps(result, indent=2)+'\n')
    rows = ['| Disjoint sample group | Sampled seconds |', '|---|---:|']
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="360"><rect width="1100" height="360" fill="white"/><text x="25" y="35" font-size="22">Complete-board clearance sample attribution (historical profile)</text>']
    for i,(name, us) in enumerate(result['disjoint_us'].items()):
        rows.append(f'| {name} | {us/1e6:.6f} |')
        y=75+i*52
        svg.append(f'<text x="25" y="{y}" font-size="17">{name}</text><rect x="420" y="{y-18}" width="{us/sum(p["timeDeltas"])*550:.3f}" height="26" fill="#287b96"/><text x="980" y="{y}" font-size="17">{us/1e6:.3f}s</text>')
    (out/'table.md').write_text('\n'.join(rows)+'\n')
    (out/'profile.svg').write_text(''.join(svg)+'</svg>\n')
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
