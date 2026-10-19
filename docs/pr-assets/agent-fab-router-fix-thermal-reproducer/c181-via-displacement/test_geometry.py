import unittest
from geometry import relocate

class ConnectedMove(unittest.TestCase):
    def test_moves_every_incident_endpoint_without_mutating_source(self):
        nodes = ['kicad_pcb', ['via', ['at','1','2'], ['net','1'], ['uuid','v']],
                 ['segment',['start','1','2'],['end','4','5'],['net','1'], ['uuid','a']],
                 ['segment',['start','6','7'],['end','1','2'],['net','1'], ['uuid','b']],
                 ['segment',['start','8','9'],['end','10','11'],['net','1'], ['uuid','c']]]
        import copy
        before = copy.deepcopy(nodes)
        result = relocate(nodes, 'v', .5, -.25, protected_ids=set())
        self.assertEqual(nodes, before)
        self.assertEqual(result[1][1], ['at','1.5','1.75'])
        self.assertEqual(result[2][1], ['start','1.5','1.75'])
        self.assertEqual(result[3][2], ['end','1.5','1.75'])
        self.assertEqual(result[2][2], before[2][2])
        self.assertEqual(result[4], before[4])

if __name__ == '__main__': unittest.main()
