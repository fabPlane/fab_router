"""Native polygon diagnostic controls, including gaps missed by point sampling."""
import unittest
import pcbnew
from corridor import rectangle, coverage

class CorridorTests(unittest.TestCase):
    def test_solid(self):
        self.assertEqual(coverage(rectangle(-1000, -254000, 1001000, 254000), 0, -254000, 1000000, 254000)['missing_area_nm2'], 0)

    def test_subsample_slit(self):
        copper = rectangle(-1000, -254000, 1001000, 254000)
        copper.BooleanSubtract(rectangle(10000, -254001, 11000, 254001))
        # Old 25 um samples at all three lateral offsets falsely look filled.
        self.assertTrue(all(copper.Contains(pcbnew.VECTOR2I(x, y))
                            for x in range(0, 1000001, 25000)
                            for y in (-127000, 0, 127000)))
        self.assertEqual(coverage(copper, 0, -254000, 1000000, 254000)['missing_area_nm2'], 508000000)

    def test_outer_width(self):
        copper = rectangle(-1000, -200000, 1001000, 200000)
        self.assertTrue(all(copper.Contains(pcbnew.VECTOR2I(x, y))
                            for x in range(0, 1000001, 25000)
                            for y in (-127000, 0, 127000)))
        self.assertEqual(coverage(copper, 0, -254000, 1000000, 254000)['missing_area_nm2'], 108000000000)

    def test_hole(self):
        copper = rectangle(-1000, -254000, 1001000, 254000)
        copper.BooleanSubtract(rectangle(10000, 200000, 11000, 201000))
        self.assertEqual(coverage(copper, 0, -254000, 1000000, 254000)['missing_area_nm2'], 1000000)

    def test_no_mutation(self):
        copper = rectangle(-1000, -254000, 1001000, 254000)
        before = copper.Area()
        coverage(copper, -10000, -254000, 1000000, 254000)
        self.assertEqual(copper.Area(), before)

    def test_degenerate_rejected(self):
        with self.assertRaises(ValueError):
            coverage(rectangle(0, 0, 100, 100), 0, 0, 0, 100)

if __name__ == '__main__':
    unittest.main()
