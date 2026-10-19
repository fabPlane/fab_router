#!/usr/bin/python3
"""Controls for the new offline bent-link experiment, not an engine regression."""
import copy,math
import native,transaction
link=transaction.module('dogleg_controls','thermal-doglegs.py')
nodes=native.parse('(kicad_pcb (version 20260206) (segment (uuid "retained")))')
original=copy.deepcopy(nodes)
for angle in (0,45,315):
    args=(nodes,(1000000,2000000),angle,'"N"','"B.Cu"',508000)
    proposals=list(link.proposals(*args));assert len(proposals)==16
    assert proposals==list(link.proposals(*args))
    ids=set()
    for meta,data in proposals:
        tree=native.parse(data.decode());assert tree[:-2]==nodes
        points=[args[1],meta['bend_nm'],meta['end_nm']]
        for index,track in enumerate(tree[-2:]):
            point=lambda key:tuple(round(float(v)*1e6) for v in native.child(track,key)[1:])
            assert point('start')==points[index] and point('end')==points[index+1]
            assert point('start')!=point('end')
            assert native.child(track,'net')==['net','"N"']
            assert native.child(track,'layer')==['layer','"B.Cu"']
            assert native.child(track,'width')==['width','0.127000']
            assert native.uid(track) not in ids;ids.add(native.uid(track))
        a=tuple(y-x for x,y in zip(points[0],points[1]))
        b=tuple(y-x for x,y in zip(points[1],points[2]))
        assert abs(math.hypot(*a)-127000)<=1
        assert abs(math.hypot(*b)-1524000)<=1
        assert abs(sum(x*y for x,y in zip(a,b)))<=4*508000
    old=link.TARGET;link.TARGET='0058b9c6-73af-4ba8-a061-fb00a457a84f'
    other=list(link.proposals(*args));link.TARGET=old
    assert [m for m,_ in proposals]==[m for m,_ in other]
    assert ids.isdisjoint(native.uid(n) for _,data in other for n in native.parse(data.decode())[-2:])
assert nodes==original
for gap in (-1,0,1,3):
    try:list(link.proposals(nodes,(0,0),0,'"N"','"B.Cu"',gap))
    except ValueError:pass
    else:raise AssertionError(gap)
print('PASS: 48 deterministic connected doglegs; rotations, two-sided bends, metadata, edit boundary, pad-scoped identities and invalid scales')
