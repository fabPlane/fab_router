"""Endpoint-preserving bounded detours, including axis-aligned causal tracks."""
import math


def paths(start, end):
    dx, dy = end[0]-start[0], end[1]-start[1]
    length = math.hypot(dx, dy)
    if not length:
        raise ValueError('zero-length segment')
    ux, uy = dx/length, dy/length
    for offset in (.25, -.25, .5, -.5, 1, -1, 2, -2):
        lead = min(abs(offset), length/4)
        yield [start,
               (start[0]+ux*lead-uy*offset, start[1]+uy*lead+ux*offset),
               (end[0]-ux*lead-uy*offset, end[1]-uy*lead+ux*offset), end]
