"""Controls distinguish locally filled strips from shared remote copper."""
import unittest
from corridor import rectangle
from components import inspect_components

class ComponentTests(unittest.TestCase):
    def test_connected(self):
        p = rectangle(0, 0, 1000, 100)
        self.assertEqual(inspect_components(p, (0,0,100,100), (-10,-10,500,110))['remote_covering_components'], [0])

    def test_detached_strip_and_remote_island(self):
        p = rectangle(0,0,100,100)
        p.BooleanAdd(rectangle(600,0,1000,100))
        result = inspect_components(p, (0,0,100,100), (-10,-10,500,110))
        self.assertTrue(result['union_strip_covered'])
        self.assertEqual(result['remote_covering_components'], [])

    def test_slit_separates_remote_copper(self):
        p = rectangle(0,0,1000,100)
        p.BooleanSubtract(rectangle(200,-10,201,110))
        self.assertEqual(inspect_components(p, (0,0,100,100), (-10,-10,500,110))['remote_covering_components'], [])

    def test_hole_and_input_preserved(self):
        p = rectangle(0,0,1000,1000)
        p.BooleanSubtract(rectangle(200,200,800,800))
        before = (p.Area(), p.HoleCount(0))
        self.assertEqual(inspect_components(p, (0,0,100,100), (-10,-10,500,1100))['remote_covering_components'], [0])
        self.assertEqual((p.Area(), p.HoleCount(0)), before)

if __name__ == '__main__':
    unittest.main()
