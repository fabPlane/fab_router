import importlib.util
from pathlib import Path
import unittest

s = importlib.util.spec_from_file_location('search', Path(__file__).with_name('search.py'))
m = importlib.util.module_from_spec(s)
s.loader.exec_module(m)

class SearchTests(unittest.TestCase):
    def test_all_quadrants_and_reversed_endpoints(self):
        for start, end in [((4, 5), (1, 1)), ((1, 5), (4, 1)),
                           ((4, 1), (1, 5)), ((1, 1), (4, 5))]:
            for points in m.paths(start, end):
                self.assertEqual(points[0], start)
                self.assertEqual(points[-1], end)
                self.assertEqual(len(points), 4)
                for a, b in zip(points, points[1:]):
                    dx, dy = abs(a[0]-b[0]), abs(a[1]-b[1])
                    self.assertTrue(dx == 0 or dy == 0 or abs(dx-dy) < 1e-9)
                    self.assertNotEqual(a, b)
            self.assertEqual(len(list(m.paths(start, end))), 6)

    def test_axis_aligned_segment_has_no_candidate(self):
        for end in ((0, 2), (2, 0), (0, 0)):
            self.assertEqual(list(m.paths((0, 0), end)), [])

    def test_every_candidate_is_a_continuous_same_net_replacement(self):
        witness = m.native.parse('(segment (start 4 5) (end 1 1) (width 0.25) (layer "F.Cu") (net 2) (uuid "cause"))')
        nodes = ['kicad_pcb', witness, ['version', '20260101']]
        candidates = list(m.proposals(nodes, 'cause'))
        self.assertEqual(len(candidates), 6)
        for data in candidates:
            parsed = m.native.parse(data.decode())
            tracks = [n for n in parsed if isinstance(n, list) and n[0] == 'segment']
            self.assertEqual(len(tracks), 3)
            for key in ('width', 'layer', 'net'):
                self.assertTrue(all(m.native.child(t, key) == m.native.child(witness, key) for t in tracks))
            self.assertEqual(len({m.native.uid(t) for t in tracks}), 3)
        self.assertEqual(nodes[1], witness)
        self.assertEqual(list(m.proposals(nodes, 'cause')), candidates)

if __name__ == '__main__':
    unittest.main()
