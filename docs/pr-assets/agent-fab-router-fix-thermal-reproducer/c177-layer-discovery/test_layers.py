import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('complete',Path(__file__).with_name('complete.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Layers(unittest.TestCase):
 def test_same_layer_budget_and_original_exclusion(self):
  n=m.native.parse('(kicad_pcb (zone (uuid z) (layer "B.Cu")) (footprint (pad (uuid p))) (segment (uuid front) (layer "F.Cu") (start 0 0) (end 1 0)) (segment (uuid back) (layer "B.Cu") (start 0 2) (end 1 2)) (segment (uuid original) (layer "B.Cu") (start 0 0) (end 1 0)))')
  e=[dict(type='starved_thermal',items=[dict(uuid='z'),dict(uuid='p',pos=dict(x=0,y=0))])]
  self.assertEqual(m.single.rank_segments(n,{'original'},e,1),['back'])
 def test_unknown_zone_fails_closed(self):
  n=m.native.parse('(kicad_pcb (footprint (pad (uuid p))) (segment (uuid t) (layer "B.Cu") (start 0 0) (end 1 0)))')
  self.assertEqual(m.single.rank_segments(n,set(),[dict(type='starved_thermal',items=[dict(uuid='p',pos=dict(x=0,y=0))])],8),[])
 def test_pairs_use_layer_filtered_budget(self):
  segments=' '.join(f'(segment (uuid {layer}{j}) (layer "{layer}.Cu") (net 1) (width .25) (start {j} {y}) (end {j+1} {y}))' for layer,y in [('F',0),('B',2)] for j in range(2))
  n=m.native.parse('(kicad_pcb (zone (uuid z) (layer "B.Cu")) (footprint (pad (uuid p))) '+segments+')')
  e=[dict(type='starved_thermal',items=[dict(uuid='z'),dict(uuid='p',pos=dict(x=0,y=0))])]
  self.assertEqual(m.pair.rank_pairs(n,set(),e,16),[('B0','B1')])
if __name__=='__main__':unittest.main()
