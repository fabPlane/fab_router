#!/usr/bin/env python3
"""Bounded thermal proposals on disposable native board text, never authored copper.
Geometry families retain the prior offline single-track and connected-pair search.
Native acceptance is performed by native-thermal-search.ts, not this generator.
"""
import argparse
import copy
from decimal import Decimal
import json
import math
from itertools import islice
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

def segment_geometry(n):
    """Exact physical match independent of import UUIDs and endpoint direction.
    Extra per-item metadata cannot make coincident source copper safe to edit;
    conservatively exclude every physical match, including duplicate imports.
    Decimal avoids floating-point tolerances when comparing authored geometry.
    """
    ends = [tuple(Decimal(v) for v in child(n, key)[1:])
            for key in ('start', 'end')]
    return (tuple(sorted(ends)), Decimal(child(n, 'width')[1]),
            tuple(child(n, 'layer')[1:]), tuple(
                v if v.startswith(chr(34)) else Decimal(v)
                for v in child(n, 'net')[1:]))


def via_geometry(n):
    # Ignore identity and metadata: a reidentified authored via stays protected.
    return (tuple(Decimal(v) for v in child(n, 'at')[1:3]),
            Decimal(child(n, 'size')[1]), tuple(Decimal(v) if re.fullmatch(r'[+\-0-9.eE]+', v) else v
                                              for v in child(n, 'drill')[1:]),
            tuple(child(n, 'layers')[1:]), tuple(child(n, 'net')[1:]))


def protected_ids(source, current):
    identities = {uid(n) for n in source if isinstance(n, list) and uid(n)}
    geometry = {segment_geometry(n) for n in source
                if isinstance(n, list) and n[0] == 'segment'}
    vias = {via_geometry(n) for n in source
            if isinstance(n, list) and n[0] == 'via'}
    return identities | {uid(n) for n in current if isinstance(n, list)
                         and ((n[0] == 'segment' and segment_geometry(n) in geometry)
                              or (n[0] == 'via' and via_geometry(n) in vias))}


def paths(start, end):
    dx, dy = end[0]-start[0], end[1]-start[1]
    if not dx and not dy:
        return
    if not dx or not dy:
        # Six endpoint-preserving 45-degree detours, just as for diagonals.
        # Keep bends short of the midpoint to avoid zero-length middle tracks.
        length = abs(dx or dy)
        along = (1 if dx > 0 else -1, 0) if dx else (0, 1 if dy > 0 else -1)
        normal = (0, 1) if dx else (1, 0)
        for fraction in (0.125, 0.25, 0.375):
            radius = length * fraction
            for side in (1, -1):
                offset = (normal[0]*side*radius, normal[1]*side*radius)
                yield [start, (start[0]+along[0]*radius+offset[0],
                               start[1]+along[1]*radius+offset[1]),
                       (end[0]-along[0]*radius+offset[0],
                        end[1]-along[1]*radius+offset[1]), end]
        return
    sx, sy = (1 if dx > 0 else -1), (1 if dy > 0 else -1)
    for fraction in (0.125, 0.25, 0.5):
        radius = min(abs(dx), abs(dy)) * fraction
        yield [start, (start[0], end[1]-sy*radius),
               (start[0]+sx*radius, end[1]), end]
        yield [start, (end[0]-sx*radius, start[1]),
               (end[0], start[1]+sy*radius), end]


def short_paths(start, end, width):
    """Width-scale axial ramps supplement length-scale paths in unused slots.
    Keep the existing families and ordering intact; native acceptance decides
    whether a local offset actually restores the thermal without other damage.
    """
    dx, dy = end[0]-start[0], end[1]-start[1]
    if (not dx and not dy) or (dx and dy) or not math.isfinite(width) or width <= 0:
        return
    length = abs(dx or dy)
    along = (1 if dx > 0 else -1, 0) if dx else (0, 1 if dy > 0 else -1)
    normal = (0, 1) if dx else (1, 0)
    seen = set()
    for fraction in (.3, .25, .35):
        radius = min(width*fraction, length*.375)
        if radius < .000001 or radius in seen:
            continue
        seen.add(radius)
        for side in (1, -1):
            offset = (normal[0]*side*radius, normal[1]*side*radius)
            yield [start, (start[0]+along[0]*radius+offset[0],
                           start[1]+along[1]*radius+offset[1]),
                   (end[0]-along[0]*radius+offset[0],
                    end[1]-along[1]*radius+offset[1]), end]


def proposals(nodes, segment_id, short=False):
    witness = next(n for n in nodes if isinstance(n, list)
                   and n[0] == 'segment' and native.uid(n) == segment_id)
    start, end = (tuple(float(v) for v in native.child(witness, key)[1:])
                  for key in ('start', 'end'))
    variants = short_paths(start, end, float(native.child(witness, 'width')[1])) if short else paths(start, end)
    for index, points in enumerate(variants):
        candidate = copy.deepcopy(nodes)
        candidate.remove(next(n for n in candidate if isinstance(n, list)
                              and n[0] == 'segment' and native.uid(n) == segment_id))
        for j, (a, b) in enumerate(zip(points, points[1:])):
            track = copy.deepcopy(witness)
            for key, point in [('start', a), ('end', b)]:
                native.child(track, key)[1:] = [f'{v:.6f}' for v in point]
            native.child(track, 'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL,
                f'full-board-{"short-" if short else ""}detour-{segment_id}-{index}-{j}'))+'"'
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



def via_proposals(nodes, via_id, protected):
    """Move a generated via and ALL coincident incident segment endpoints.

    This only proposes geometry. Interior contacts, pads and zone connections
    still require the full native ownership/connectivity/DRC acceptance gate.
    Refuse authored contacts, ambiguous stacked vias and unsupported arcs.
    """
    via = next(n for n in nodes if isinstance(n, list)
               and n[0] == 'via' and uid(n) == via_id)
    if via_id in protected:
        return
    point = tuple(Decimal(v) for v in child(via, 'at')[1:3])
    incident = []
    for n in nodes:
        if not isinstance(n, list) or n[0] not in ('segment', 'arc', 'via') or n is via:
            continue
        keys = [key for key in ('start', 'end', 'mid', 'at')
                if child(n, key) and tuple(Decimal(v) for v in child(n, key)[1:3]) == point]
        if not keys:
            continue
        if (n[0] != 'segment' or not uid(n) or uid(n) in protected
                or child(n, 'net') != child(via, 'net')):
            return
        incident.append((uid(n), keys))
    if not incident:
        return
    # Fixed small family. Exact
    # decimals preserve endpoint contact without imposing a rounding tolerance.
    for dx, dy in ((-.3, .3), (.3, .3), (-.3, -.3), (.3, -.3),
                   (-.3, 0), (.3, 0), (0, -.3), (0, .3)):
        moved = [format(v + Decimal(str(d)), 'f') for v, d in zip(point, (dx, dy))]
        candidate = copy.deepcopy(nodes)
        edits = dict(incident)
        edits[via_id] = ['at']
        for n in candidate:
            if isinstance(n, list) and uid(n) in edits:
                for key in edits[uid(n)]:
                    child(n, key)[1:3] = moved
        yield (dump(candidate) + '\n').encode()


def rank_vias(nodes, protected, errors, limit=4):
    pads = {uid(c) for n in nodes if isinstance(n, list) and n[0] == 'footprint'
            for c in n if isinstance(c, list) and c[0] == 'pad'}
    points = [(i['pos']['x'], i['pos']['y']) for e in errors if e['type'] == 'starved_thermal'
              for i in e['items'] if i['uuid'] in pads]
    if not points:
        return []
    def distance(via):
        x, y = map(float, child(via, 'at')[1:3])
        return min((x-a)**2 + (y-b)**2 for a, b in points), uid(via)
    vias = [n for n in nodes if isinstance(n, list) and n[0] == 'via'
            and uid(n) and uid(n) not in protected]
    return [uid(n) for n in sorted(vias, key=distance)[:limit]]


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('source','current','report','out'):p.add_argument('--'+name,type=Path,required=True)
    x=p.parse_args()
    source=parse(x.source.read_text());nodes=parse(x.current.read_text())
    assert source[0]==nodes[0]=='kicad_pcb'
    # Legacy drawings can share UUIDs; they are never selected or rewritten.
    # Still reject any collision involving copper, footprints, zones or an
    # unknown item: segment selection/removal must remain unambiguous.
    drawings = {'gr_line', 'gr_circle', 'gr_arc', 'gr_rect', 'gr_poly',
                'gr_text', 'gr_text_box', 'gr_curve'}
    for board in (source, nodes):
        identities = {}
        for item in board:
            if isinstance(item, list) and uid(item):
                identities.setdefault(uid(item), []).append(item[0])
        if any(len(kinds) > 1 and not all(kind in drawings for kind in kinds)
               for kinds in identities.values()):
            raise ValueError('Ambiguous native item identities')
    protected=protected_ids(source,nodes)
    errors=json.loads(x.report.read_text())['newErrors']
    x.out.mkdir(exist_ok=False)
    rows=[]
    def add(label, candidates):
        for data in candidates:
            name=f'{len(rows):03}.kicad_pcb'
            (x.out/name).write_bytes(data)
            rows.append(dict(name=name,label=label))
    ranked = rank_segments(nodes,protected,errors,8)
    tracks = {uid(n): n for n in nodes if isinstance(n,list) and n[0]=='segment'}
    def axial(ident):
        a, b = [tuple(map(float,child(tracks[ident],key)[1:])) for key in ('start','end')]
        return a[0] == b[0] or a[1] == b[1]
    # Generate the complete prior proposal set before filling unused slots.
    # The bounded via probe below changes evaluation order, not geometry.
    for ident in ranked:
        if not axial(ident):
            add(['segment',ident],proposals(nodes,ident))
    for idents in rank_pairs(nodes,protected,errors,16):
        add(['pair',list(idents)],pair_proposals(nodes,idents))
    for ident in ranked:
        if axial(ident):
            add(['segment',ident],proposals(nodes,ident))
    # Append geometry only after the complete prior prefix. Never exceed the
    # 304-check budget or displace any prior diagonal/pair/axial candidate.
    for ident in ranked:
        if axial(ident):
            add(['short-axial',ident],islice(proposals(nodes,ident,short=True),304-len(rows)))
    for ident in rank_vias(nodes, protected, errors):
        add(['via', ident], islice(via_proposals(nodes, ident, protected), 304-len(rows)))
    assert len(rows)<=304
    # Probe one representative of the nearest connected-via family after the
    # first six track detours, before spending the budget on track combinations.
    # Keep every generated file and the relative order of all other proposals;
    # only native validation may accept the probe. Boards without eligible vias
    # retain their exact manifest order and candidate bytes.
    first_via = next((i for i, row in enumerate(rows) if row['label'][0] == 'via'), None)
    if first_via is not None and first_via > 6:
        rows.insert(6, rows.pop(first_via))
    (x.out/'manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
if __name__=='__main__':main()
