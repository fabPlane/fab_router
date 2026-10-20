import copy
import unittest
import gzip
import json
from pathlib import Path
from analyze import partition


def node(i, name, path, children=()):
    return {"id": i, "callFrame": {"functionName": name, "url": "/src/" + path}, "children": list(children)}


class PartitionTests(unittest.TestCase):
    def setUp(self):
        self.p = {"nodes": [node(1, "aStar", "route/search.ts", [2, 5]), node(2, "state", "route/quilt.ts", [3]), node(3, "sweepClear", "route/clear.ts", [4]), node(4, "collect", "lattice/grid.ts"), node(5, "probe", "route/search.ts")], "samples": [1, 2, 3, 4, 5], "timeDeltas": [1, 2, 3, 4, 5]}

    def test_nearest_and_conservation(self):
        r = partition(self.p)
        self.assertEqual(r["disjoint_us"], {"search remainder": 1, "quilt remainder": 2, "geometry and clearance": 3, "lattice": 4, "visited table": 5})
        self.assertEqual(sum(r["disjoint_us"].values()), 15)
        self.assertEqual(sum(r["context_us"].values()), 15)

    def test_path_and_nested_search(self):
        self.p["nodes"][4]["callFrame"]["url"] = "/src/unrelated.ts"
        self.p["nodes"].append(node(6, "aStarLayered", "route/search.ts", [1]))
        r = partition(self.p)
        self.assertEqual(r["disjoint_us"]["search remainder"], 6)
        self.assertTrue(all(k.startswith("aStar / ") for k in r["context_us"]))

    def test_retained_profiles(self):
        root = Path(__file__).resolve().parent
        expected = json.loads((root / "summary.json").read_text())
        for name, recorded in expected.items():
            with self.subTest(profile=name):
                result = partition(json.loads(gzip.decompress((root / name).read_bytes())))
                self.assertEqual(result, {k: v for k, v in recorded.items() if k != "sha256"})
                self.assertEqual(sum(result["disjoint_us"].values()), result["sampled_us"])
                self.assertEqual(sum(result["context_us"].values()), result["sampled_us"])

    def test_corruption(self):
        mutations = [lambda p: p["nodes"].append(copy.deepcopy(p["nodes"][0])), lambda p: p["nodes"][0]["children"].append(999), lambda p: p["nodes"][4]["children"].append(1), lambda p: p["samples"].append(1), lambda p: p["samples"].__setitem__(0, 999), lambda p: p["timeDeltas"].__setitem__(0, -1), lambda p: p["timeDeltas"].__setitem__(0, float("nan"))]
        for mutate in mutations:
            p = copy.deepcopy(self.p)
            mutate(p)
            with self.assertRaises(ValueError):
                partition(p)


if __name__ == "__main__":
    unittest.main()
