import copy
import unittest
from analyze import analyze


def node(i, name, children=()):
    return dict(id=i, callFrame=dict(functionName=name, url='/snapshot/src/test.ts', lineNumber=0), children=list(children))


class Attribution(unittest.TestCase):
    def setUp(self):
        self.d = dict(nodes=[node(1,'root',[2]),node(2,'recursive',[3]),node(3,'recursive',[4]),node(4,'leaf')], samples=[4,3], timeDeltas=[2000,1000])

    def test_recursive_frames_are_counted_once(self):
        result = analyze(self.d)
        frames = {f['function']:f for f in result['frames']}
        self.assertEqual(result['sampled_ms'], 3)
        self.assertEqual(frames['recursive']['inclusive_ms'], 3)
        self.assertEqual(frames['recursive']['self_ms'], 1)
        self.assertEqual(frames['leaf']['inclusive_ms'], 2)
        self.assertEqual(sum(f['self_ms'] for f in frames.values()), 3)
        self.assertTrue(all(e['inclusive_ms'] <= 3 for e in result['edges']))

    def test_corruption_rejected(self):
        mutations = [lambda d:d['nodes'].append(d['nodes'][0]),
                     lambda d:d['nodes'][3]['children'].append(1),
                     lambda d:d['nodes'][0]['children'].append(4),
                     lambda d:d['nodes'][0]['children'].append(99),
                     lambda d:d['samples'].append(1),
                     lambda d:d['samples'].__setitem__(0,99),
                     lambda d:d['timeDeltas'].__setitem__(0,-1),
                     lambda d:d['timeDeltas'].__setitem__(0,float('nan')),
                     lambda d:d['nodes'].append(node(5,'disconnected'))]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                d = copy.deepcopy(self.d)
                mutation(d)
                with self.assertRaises(ValueError):
                    analyze(d)


if __name__ == '__main__':
    unittest.main()
