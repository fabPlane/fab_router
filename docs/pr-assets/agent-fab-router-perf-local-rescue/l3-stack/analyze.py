"""Attribute retained CPU samples to frames and immediate caller edges.

Inclusive totals count each normalized frame once per sampled stack, so recursion
cannot inflate a frame beyond total sampled time. Edge totals use the same rule.
These sampled stacks reflect JIT attribution, not exact elapsed function costs.
"""
from pathlib import Path
import collections
import gzip
import json
import math
import sys


def analyze(d):
    nodes = {n['id']: n for n in d['nodes']}
    if len(nodes) != len(d['nodes']):
        raise ValueError('duplicate node')
    parents = {}
    frames = {}
    for ident, node in nodes.items():
        f = node['callFrame']
        url = f['url']
        if '/src/' in url:
            url = url[url.index('/src/') + 1:]
        frames[ident] = (f['functionName'], url, f['lineNumber'] + 1)
        for child in node.get('children', []):
            if child not in nodes or child in parents:
                raise ValueError('missing child or multiple parents')
            parents[child] = ident
    stacks = {}
    for ident in nodes:
        chain, seen, cur = [], set(), ident
        while True:
            if cur in seen:
                raise ValueError('cycle')
            seen.add(cur)
            chain.append(frames[cur])
            if cur not in parents:
                break
            cur = parents[cur]
        stacks[ident] = chain
    if len(nodes) - len(parents) != 1:
        raise ValueError('expected one root')
    if len(d['samples']) != len(d['timeDeltas']):
        raise ValueError('sample/delta mismatch')
    own, inclusive, edges = (collections.Counter() for _ in range(3))
    total = 0
    for ident, delta in zip(d['samples'], d['timeDeltas']):
        if ident not in nodes or not isinstance(delta, (int, float)) or not math.isfinite(delta) or delta < 0:
            raise ValueError('invalid sample or delta')
        chain = stacks[ident]
        total += delta
        own[chain[0]] += delta
        for frame in set(chain):
            inclusive[frame] += delta
        for edge in set(zip(chain[1:], chain)):
            edges[edge] += delta
    def frame(f):
        return dict(function=f[0], file=f[1], line=f[2])
    return dict(sampled_ms=total / 1000,
                frames=[dict(**frame(f), self_ms=own[f]/1000, inclusive_ms=t/1000)
                        for f,t in inclusive.most_common()],
                edges=[dict(caller=frame(a), callee=frame(b), inclusive_ms=t/1000)
                       for (a,b),t in edges.most_common()])


if __name__ == '__main__':
    source = Path(__file__).resolve().parent.parent / 'l3-profile'
    result = {}
    for mode in ['original', 'candidate']:
        result[mode] = analyze(json.loads(gzip.decompress((source / f'{mode}.cpuprofile.gz').read_bytes())))
    print(json.dumps(result, indent=2))
