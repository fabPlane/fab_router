"""Erosion controls distinguish component extent from narrow copper access."""
import unittest
from corridor import rectangle
from necks import remote_after_erosion

class NeckTests(unittest.TestCase):
    def check(self, copper, expected):
        before = (copper.Area(), copper.OutlineCount(), copper.HoleCount(0))
        result = remote_after_erosion(copper, (50, 50), (-10,-10,500,110), 20, 1)
        self.assertEqual(result['remote_reachable'], expected)
        self.assertEqual((copper.Area(), copper.OutlineCount(), copper.HoleCount(0)), before)

    def test_wide_corridor(self):
        self.check(rectangle(0,0,1000,100), True)

    def test_narrow_neck(self):
        p = rectangle(0,0,200,100)
        p.BooleanAdd(rectangle(200,45,600,55))
        p.BooleanAdd(rectangle(600,0,1000,100))
        self.check(p, False)

    def test_detached(self):
        p = rectangle(0,0,200,100)
        p.BooleanAdd(rectangle(600,0,1000,100))
        self.check(p, False)

    def test_hole_blocks_narrow_passages(self):
        p = rectangle(0,0,1000,100)
        p.BooleanSubtract(rectangle(200,10,600,90))
        self.check(p, False)

    def test_anchor_eroded(self):
        self.assertFalse(remote_after_erosion(rectangle(0,0,1000,100), (1,1), (-10,-10,500,110),20,1)['remote_reachable'])

    def test_invalid_parameters(self):
        p = rectangle(0,0,1000,100)
        for radius,error in ((-1,1),(20,0),(20,21)):
            with self.assertRaises(ValueError):
                remote_after_erosion(p,(50,50),(-10,-10,500,110),radius,error)

if __name__ == '__main__':
    unittest.main()
