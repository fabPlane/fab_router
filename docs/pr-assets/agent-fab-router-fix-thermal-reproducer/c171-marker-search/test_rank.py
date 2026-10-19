import unittest
import search

class RankingTests(unittest.TestCase):
    def test_generated_only_pad_markers_and_stable_distance_order(self):
        nodes = search.native.parse('(kicad_pcb (segment (start 0 0) (end 1 1) (uuid "original")) (segment (start 2 0) (end 2 2) (uuid "near")) (segment (start 8 0) (end 8 2) (uuid "far")) (zone (uuid "zone")) (footprint (pad "1" smd rect (uuid "pad"))))')
        errors = [{'type':'starved_thermal', 'items':[
            {'uuid':'zone','pos':{'x':8,'y':1}},
            {'uuid':'pad','pos':{'x':0,'y':1}}]}]
        self.assertEqual(search.rank_segments(nodes, {'original'}, errors, 8), ['near','far'])
        self.assertEqual(search.rank_segments(nodes, {'original'}, errors, 1), ['near'])
        self.assertEqual(search.rank_segments(nodes, {'original'}, [], 8), [])
        self.assertEqual(search.rank_segments(nodes, {'original'}, [{'type':'clearance','items':errors[0]['items']}], 8), [])

if __name__ == '__main__': unittest.main()
