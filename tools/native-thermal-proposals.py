#!/usr/bin/env python3
"""Bounded thermal proposals on disposable native board text, never authored copper.
Geometry families retain the prior offline single-track and connected-pair search.
Native acceptance is performed by native-thermal-search.ts, not this generator.
"""
import argparse
import copy
import json
import re
import sys
import uuid
from pathlib import Path
def parse(s):
 """Read exactly one complete tree; reject ignored or ambiguous design bytes."""
 stack=[];root=None;offset=0
 tokens=re.compile(r'"(?:\\.|[^"\\])*"|[()]|[^\s()"]+')
 for match in tokens.finditer(s):
  if s[offset:match.start()].strip():raise ValueError('invalid S-expression token')
  offset=match.end();t=match.group()
  if t=='(':
   if not stack and root is not None:raise ValueError('multiple S-expression roots')
   n=[]
   if stack:stack[-1].append(n)
   stack.append(n)
  elif t==')':
   if not stack:raise ValueError('unmatched S-expression close')
   n=stack.pop()
   if not stack:root=n
  else:
   if not stack:raise ValueError('atom outside S-expression root')
   stack[-1].append(t)
 if s[offset:].strip() or stack or root is None:raise ValueError('incomplete S-expression')
 return root
def dump(n):return '('+' '.join(map(dump,n))+')' if isinstance(n,list) else n
def child(n,k):return next((x for x in n if isinstance(x,list) and x[0]==k),None)
def uid(n):
 u=child(n,'uuid');return u[1].strip('"') if u else None

native=sys.modules[__name__]

def paths(start, end):
    dx, dy = end[0]-start[0], end[1]-start[1]
    if not dx or not dy:
        return
    sx, sy = (1 if dx > 0 else -1), (1 if dy > 0 else -1)
    for fraction in (0.125, 0.25, 0.5):
        radius = min(abs(dx), abs(dy)) * fraction
        yield [start, (start[0], end[1]-sy*radius),
               (start[0]+sx*radius, end[1]), end]
        yield [start, (end[0]-sx*radius, start[1]),
               (end[0], start[1]+sy*radius), end]


def proposals(nodes, segment_id):
    witness = next(n for n in nodes if isinstance(n, list)
                   and n[0] == 'segment' and native.uid(n) == segment_id)
    start, end = (tuple(float(v) for v in native.child(witness, key)[1:])
                  for key in ('start', 'end'))
    for index, points in enumerate(paths(start, end)):
        candidate = copy.deepcopy(nodes)
        candidate.remove(next(n for n in candidate if isinstance(n, list)
                              and n[0] == 'segment' and native.uid(n) == segment_id))
        for j, (a, b) in enumerate(zip(points, points[1:])):
            track = copy.deepcopy(witness)
            for key, point in [('start', a), ('end', b)]:
                native.child(track, key)[1:] = [f'{v:.6f}' for v in point]
            native.child(track, 'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL,
                f'full-board-detour-{segment_id}-{index}-{j}'))+'"'
            candidate.append(track)
        yield (native.dump(candidate)+'\n').encode()


def rank_segments(nodes, original_ids, errors, limit):
    """Rank generated tracks by distance to actual thermal pad markers, never zone anchors."""
    pads = {native.uid(c) for n in nodes if isinstance(n, list) and n[0] == 'footprint'
            for c in n if isinstance(c, list) and c[0] == 'pad'}
    points = [(i['pos']['x'], i['pos']['y']) for e in errors if e['type'] == 'starved_thermal'
              for i in e['items'] if i['uuid'] in pads]
    if not points:
        return []
    def distance(n):
        a, b = [tuple(map(float, native.child(n, k)[1:])) for k in ('start', 'end')]
        dx, dy = b[0]-a[0], b[1]-a[1]
        length2 = dx*dx+dy*dy
        def squared(p):
            t = max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2)) if length2 else 0
            return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
        return min(map(squared, points)), native.uid(n)
    tracks = [n for n in nodes if isinstance(n, list) and n[0] == 'segment'
              and native.uid(n) and native.uid(n) not in original_ids]
    return [native.uid(n) for n in sorted(tracks, key=distance)[:limit]]



def pair_paths(start, joint, end):
    for distance in (0.25, 0.5, 1., 2.):
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            point = (joint[0]+distance*dx, joint[1]+distance*dy)
            if point != start and point != end:
                yield [start, point, end]


def pair_proposals(nodes, segment_ids):
    tracks = [next(n for n in nodes if isinstance(n,list) and n[0]=='segment'
                   and native.uid(n)==uid) for uid in segment_ids]
    assert len(tracks) == 2
    assert all(native.child(tracks[0], k) == native.child(tracks[1], k)
               for k in ('width','layer','net'))
    endpoints = [[tuple(map(float,native.child(t,k)[1:])) for k in ('start','end')]
                 for t in tracks]
    shared = set(endpoints[0]) & set(endpoints[1])
    assert len(shared) == 1
    joint = shared.pop()
    start, end = [next(p for p in pair if p != joint) for pair in endpoints]
    for index, points in enumerate(pair_paths(start,joint,end)):
        candidate = copy.deepcopy(nodes)
        candidate = [n for n in candidate if not (isinstance(n,list)
                     and n[0]=='segment' and native.uid(n) in segment_ids)]
        for j,(a,b) in enumerate(zip(points,points[1:])):
            track = copy.deepcopy(tracks[j])
            for key, point in [('start',a),('end',b)]:
                native.child(track,key)[1:] = [f'{v:.6f}' for v in point]
            native.child(track,'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL,
                f'corner-{segment_ids}-{index}-{j}'))+'"'
            candidate.append(track)
        yield (native.dump(candidate)+'\n').encode()


def rank_pairs(nodes, original_ids, errors, limit):
    """Bound discovery to eight marker-near generated tracks and sixteen pairs."""
    ranked = rank_segments(nodes, original_ids, errors, 8)
    tracks = {native.uid(n): n for n in nodes if isinstance(n,list) and n[0]=='segment'}
    pairs = []
    for i, a in enumerate(ranked):
        for b in ranked[i+1:]:
            left, right = tracks[a], tracks[b]
            if not all(native.child(left,k)==native.child(right,k) for k in ('width','layer','net')):
                continue
            ends = [{tuple(map(float,native.child(t,k)[1:])) for k in ('start','end')} for t in (left,right)]
            if len(ends[0]) == len(ends[1]) == 2 and len(ends[0] & ends[1]) == 1:
                pairs.append(tuple(sorted((a,b))))
    return pairs[:limit]



def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('source','current','report','out'):p.add_argument('--'+name,type=Path,required=True)
    x=p.parse_args()
    source=parse(x.source.read_text());nodes=parse(x.current.read_text())
    assert source[0]==nodes[0]=='kicad_pcb'
    ids=[uid(n) for n in source if isinstance(n,list) and uid(n)]
    current_ids=[uid(n) for n in nodes if isinstance(n,list) and uid(n)]
    if len(ids)!=len(set(ids)) or len(current_ids)!=len(set(current_ids)):
        raise ValueError('Ambiguous native item identities')
    errors=json.loads(x.report.read_text())['newErrors']
    x.out.mkdir(exist_ok=False)
    rows=[]
    def add(label, candidates):
        for data in candidates:
            name=f'{len(rows):03}.kicad_pcb'
            (x.out/name).write_bytes(data)
            rows.append(dict(name=name,label=label))
    for ident in rank_segments(nodes,set(ids),errors,8):
        add(['segment',ident],proposals(nodes,ident))
    for idents in rank_pairs(nodes,set(ids),errors,16):
        add(['pair',list(idents)],pair_proposals(nodes,idents))
    assert len(rows)<=304
    (x.out/'manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
if __name__=='__main__':main()
