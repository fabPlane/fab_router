import unittest
from geometry import paths

class Detours(unittest.TestCase):
    def test_axis_aligned_and_diagonal_keep_endpoints(self):
        for a,b in [((0,0),(4,0)),((0,0),(0,4)),((0,0),(4,3))]:
            candidates=list(paths(a,b))
            self.assertEqual(len(candidates),8)
            for points in candidates:
                self.assertEqual(points[0],a)
                self.assertEqual(points[-1],b)
                self.assertTrue(all(p!=q for p,q in zip(points,points[1:])))
                self.assertEqual(len(points),4)
    def test_degenerate_is_rejected(self):
        with self.assertRaises(ValueError): list(paths((1,2),(1,2)))

if __name__=='__main__': unittest.main()
