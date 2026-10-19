"""Candidate geometry must respect net ownership and immutable input copper."""
import argparse
import sys
import copy
import inspect
import importlib.util
from pathlib import Path
import unittest

parser=argparse.ArgumentParser(add_help=False)
parser.add_argument('--helper',type=Path,default=Path(__file__).resolve().parent.parent/'c181-via-displacement/geometry.py')
args,remaining=parser.parse_known_args()
sys.argv=[sys.argv[0]]+remaining
path=args.helper
spec = importlib.util.spec_from_file_location('via_geometry', path)
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

def board():
    return ['kicad_pcb',
        ['via', ['at','1','2'], ['net','1'], ['uuid','v']],
        ['segment', ['start','1','2'], ['end','4','5'], ['net','1'], ['uuid','a']],
        ['segment', ['start','6','7'], ['end','1','2'], ['net','1'], ['uuid','b']],
        ['segment', ['start','1','2'], ['end','8','9'], ['net','2'], ['uuid','foreign']]]

def move(nodes, uid, dx, dy, protected_ids):
    # Exercise the old implementation too, so the before log proves unsafe edits.
    if 'protected_ids' in inspect.signature(g.relocate).parameters:
        return g.relocate(nodes, uid, dx, dy, protected_ids=protected_ids)
    return g.relocate(nodes, uid, dx, dy)

class Ownership(unittest.TestCase):
    def test_coincident_foreign_track_is_unchanged(self):
        nodes = board(); before = copy.deepcopy(nodes)
        result = move(nodes, 'v', .5, -.25, protected_ids={'foreign'})
        self.assertEqual(nodes, before)
        self.assertEqual(result[4], before[4])
        self.assertEqual(result[1][1], ['at','1.5','1.75'])
        self.assertEqual(result[2][1], ['start','1.5','1.75'])
        self.assertEqual(result[3][2], ['end','1.5','1.75'])
        self.assertEqual(result[2][2], before[2][2])

    def test_original_incident_track_rejects_move(self):
        nodes = board(); before = copy.deepcopy(nodes)
        with self.assertRaisesRegex(ValueError, 'protected copper'):
            move(nodes, 'v', .5, 0, protected_ids={'a'})
        self.assertEqual(nodes, before)

    def test_original_via_rejects_move(self):
        nodes = board(); before = copy.deepcopy(nodes)
        with self.assertRaisesRegex(ValueError, 'protected copper'):
            move(nodes, 'v', .5, 0, protected_ids={'v'})
        self.assertEqual(nodes, before)

    def test_ownership_inventory_is_required(self):
        with self.assertRaises(TypeError):
            g.relocate(board(), 'v', .5, 0)

    def test_missing_net_rejects_move(self):
        nodes = board(); nodes[1].remove(['net','1'])
        with self.assertRaisesRegex(ValueError, 'net'):
            move(nodes, 'v', .5, 0, protected_ids=set())

if __name__ == '__main__': unittest.main()
