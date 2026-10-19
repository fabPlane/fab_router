#!/usr/bin/python3
"""Geometry controls for endpoint-preserving lane proposals (diagnostic only)."""
import copy
import transaction
lane=transaction.module('lane','lane-proposals.py')
import native
track=native.parse('(segment (start 0 0) (end 1 0) (width 0.2) (layer "B.Cu") (net "N") (uuid "a"))')
for points in ([(0,0),(0,1000000),(1000000,1000000),(1000000,0)],[(0,0),(-1000000,0),(1000000,0)]):
 original=copy.deepcopy(track);parts=lane.parts(track,points)
 assert track==original and len(parts)==len(points)-1
 assert lane.parts(track,points)==parts
 assert len({native.uid(p) for p in parts})==len(parts)
 for index,p in enumerate(parts):
  assert lane.point(p,'start')==points[index] and lane.point(p,'end')==points[index+1]
  for key in ('net','layer','width'):assert native.child(p,key)==native.child(track,key)
for points in ([],[(0,0)],[(0,0),(0,0)],[(0,0),(1,0),(1,0)]):
 try:lane.parts(track,points)
 except ValueError:pass
 else:raise AssertionError(points)
for angle in (0,45,90,135,315):
 for point in ((0,0),(123456,-345678)):
  assert all(abs(a-b)<=1 for a,b in zip(point,lane.transform(lane.transform(point,(0,0),angle), (0,0),-angle)))
print('PASS: deterministic connected lane segments, metadata, immutability, degenerate rejection and rotation round trips')
