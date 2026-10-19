#!/usr/bin/python3
"""Regression controls for coherent same-layer straight-track junction proposals."""
import copy
import json
import transaction
import native
m = transaction.module('junction', 'junction-proposals.py')
def segment(uid, a, b, net=1, layer='F.Cu'):
    return native.parse(f'(segment (start {a}) (end {b}) (width 0.2) (layer "{layer}") (net {net}) (uuid "{uid}"))')
a = segment('a','0 0','5 0')
b = segment('b','5 0','5 5')
c = segment('c','10 0','5 0')
foreign = segment('foreign','5 0','6 1',2)
back = segment('back','5 0','6 1',1,'B.Cu')
nodes = ['kicad_pcb',a,b,c,foreign,back]
original = copy.deepcopy(nodes)
assert m.shared_junction(nodes,'a',(0,0))==(5000000,0), 'isolated nearest endpoint selected'
for repeat in range(3):
    changed, moved = m.move_junction(nodes,'a',(5000000,0),(100000,200000))
    assert nodes == original
    assert moved == ['a','b','c']
    for node,key in [(changed[1],'end'),(changed[2],'start'),(changed[3],'end')]:
        assert native.child(node,key)[1:]==['5.100000','0.200000']
    assert changed[4:] == nodes[4:]
    assert native.child(changed[1],'start') == native.child(a,'start')
    for old,new in zip(nodes[1:],changed[1:]):
        for key in ('uuid','width','layer','net'):
            assert native.child(old,key)==native.child(new,key)
    for uid,point,delta in [('missing',(5000000,0),(1,1)),('a',(4000000,0),(1,1)),
                           ('a',(5000000,0),(0,0)),('a',(5000000,0),(-5000000,0))]:
        try: m.move_junction(nodes,uid,point,delta)
        except ValueError: pass
        else: raise AssertionError((uid,point,delta))
    print(json.dumps(dict(repeat=repeat+1,moved=moved,invalid_rejected=4,input_unchanged=True)))
print('PASS: three-way/reversed endpoint, foreign-net/layer, metadata, immutability and invalid controls')
