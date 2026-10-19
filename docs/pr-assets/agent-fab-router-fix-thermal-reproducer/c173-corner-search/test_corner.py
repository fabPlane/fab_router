import unittest
import corner

class CornerTests(unittest.TestCase):
    def test_shared_endpoint_moves_without_breaking_outer_endpoints(self):
        a, joint, b = (3., 4.), (2., 1.), (1.1, 1.1)
        paths = list(corner.paths(a, joint, b))
        self.assertEqual(len(paths), 16)
        self.assertEqual(len(set(tuple(p) for p in paths)), 16)
        for p in paths:
            self.assertEqual(p[0], a)
            self.assertEqual(p[-1], b)
            self.assertNotEqual(p[1], joint)
            self.assertEqual(len(p), 3)
    def test_zero_length_moves_are_excluded(self):
        for p in corner.paths((0.,0.), (0.,0.), (0.25,0.)):
            self.assertTrue(all(a != b for a,b in zip(p,p[1:])))

if __name__ == '__main__': unittest.main()
