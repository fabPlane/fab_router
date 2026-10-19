#!/usr/bin/python3
"""Controls for additive thermal-link diagnostic geometry."""
import copy
import native
import transaction
link=transaction.module('link_controls','thermal-links.py')
nodes=native.parse('(kicad_pcb (version 20260206) (segment (start 0 0) (end 1 0) (width 0.2) (layer "B.Cu") (net "N") (uuid "old")))')
original=copy.deepcopy(nodes)
for angle in (0,45,315):
 proposals=list(link.proposals(nodes,(1000000,2000000),angle,'"N"','"B.Cu"',508000))
 assert len(proposals)==24 and proposals==list(link.proposals(nodes,(1000000,2000000),angle,'"N"','"B.Cu"',508000))
 ids=set()
 for meta,data in proposals:
  tree=native.parse(data.decode());assert tree[:-1]==nodes
  track=tree[-1];assert track[0]=='segment'
  assert native.child(track,'net')==['net','"N"']
  assert native.child(track,'layer')==['layer','"B.Cu"']
  assert native.child(track,'width')[1]==f'{meta["width_nm"]/1e6:.6f}'
  start=tuple(round(float(v)*1e6) for v in native.child(track,'start')[1:])
  end=tuple(round(float(v)*1e6) for v in native.child(track,'end')[1:])
  assert start==(1000000,2000000) and start!=end
  assert abs(sum((a-b)**2 for a,b in zip(start,end))**0.5-3*508000)<=1
  assert native.uid(track) not in ids;ids.add(native.uid(track))
assert nodes==original
for gap in (0,-1):
 try:list(link.proposals(nodes,(0,0),0,'"N"','"B.Cu"',gap))
 except ValueError:pass
 else:raise AssertionError(gap)
print('PASS: 72 deterministic additive links; exact edit boundary, net/layer/width, radius, immutability and invalid-gap controls')

# Native pad.GetLayer() is not the copper layer inventory for a back SMD pad.
board=native.pcbnew.BOARD();net=native.pcbnew.NETINFO_ITEM(board,'N',1);board.Add(net)
f=native.pcbnew.FOOTPRINT(board);board.Add(f);pad=native.pcbnew.PAD(f);f.Add(pad);pad.SetNet(net)
layers=native.pcbnew.LSET();layers.AddLayer(native.pcbnew.B_Cu);pad.SetLayerSet(layers)
zone=native.pcbnew.ZONE(board);zone.SetLayer(native.pcbnew.B_Cu);zone.SetNet(net);board.Add(zone)
assert link.plane_layer(board,pad)=='"B.Cu"'
print('PASS: native back-pad plane layer comes from layer membership')
