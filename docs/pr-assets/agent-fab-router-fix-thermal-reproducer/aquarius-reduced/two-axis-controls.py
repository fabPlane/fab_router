#!/usr/bin/python3
"""Exact schedule controls for the bounded two-axis diagnostic."""
import transaction
search=transaction.module('two_axis','junction-two-axis.py')
for normal in ((1,0),(0,1),(-1,0),(0,-1),(.6,.8)):
    rows=list(search.offsets(normal,1000))
    assert len(rows)==12 and len({r[2] for r in rows})==12
    for n,t,delta in rows:
        assert delta==tuple(round(1000*(n*v+t*w)) for v,w in zip(normal,(-normal[1],normal[0])))
        assert abs(sum(v*d for v,d in zip(normal,delta))-1000*n)<=1
        assert abs(sum(v*d for v,d in zip((-normal[1],normal[0]),delta))-1000*t)<=1
assert list(search.offsets((1,0),1000))[0]==(-.5,-.4,(-500,-400))
for normal,gap in (((0,0),1000),((2,0),1000),((float('nan'),1),1000),((1,0),0),((1,0),-1)):
    try:list(search.offsets(normal,gap))
    except ValueError:pass
    else:raise AssertionError((normal,gap))
print('PASS: 60 exact two-axis offsets; five invalid inputs rejected')
