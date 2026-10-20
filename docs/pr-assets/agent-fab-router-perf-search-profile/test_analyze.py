import copy
import hashlib
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
                raw = (root / name).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), recorded["sha256"])
                result = partition(json.loads(gzip.decompress(raw)))
                self.assertEqual(result, {k: v for k, v in recorded.items() if k != "sha256"})
                self.assertEqual(sum(result["disjoint_us"].values()), result["sampled_us"])
                self.assertEqual(sum(result["context_us"].values()), result["sampled_us"])
                self.assertEqual(set(result["owner_us"]), set(result["disjoint_us"]))
                for group, entries in result["owner_us"].items():
                    self.assertEqual(sum(sum(w.values()) for w in entries.values()), result["disjoint_us"][group])

    def test_owner_self_and_descendants(self):
        # An unrecognized runtime descendant belongs to collect; clear's own
        # frame keeps only its own sample. These are disjoint, not inclusive.
        self.p["nodes"][3]["children"] = [6]
        self.p["nodes"].append(node(6, "runtime", "unrelated.ts"))
        self.p["samples"].append(6)
        self.p["timeDeltas"].append(7)
        r = partition(self.p)
        self.assertEqual(r["owner_us"]["lattice"], {"lattice/grid.ts:0 / collect": {"self_us": 4, "descendant_us": 7}})
        self.assertEqual(r["owner_us"]["geometry and clearance"], {"route/clear.ts:0 / sweepClear": {"self_us": 3, "descendant_us": 0}})
        self.assertEqual(r["disjoint_us"]["lattice"], 11)

    def test_owner_source_location_and_merge(self):
        # Different call-tree IDs at one source location merge. Different
        # lines do not, even when function names and paths are identical.
        for ident, line, weight in ((6, 10, 7), (7, 10, 11), (8, 20, 13)):
            n = node(ident, "collect", "lattice/grid.ts")
            n["callFrame"]["lineNumber"] = line
            self.p["nodes"].append(n)
            self.p["nodes"][0]["children"].append(ident)
            self.p["samples"].append(ident)
            self.p["timeDeltas"].append(weight)
        entries = partition(self.p)["owner_us"]["lattice"]
        self.assertEqual(entries["lattice/grid.ts:11 / collect"]["self_us"], 18)
        self.assertEqual(entries["lattice/grid.ts:21 / collect"]["self_us"], 13)
        self.assertEqual(len(entries), 3)

    def test_owner_remainders_and_zero_duration(self):
        self.p["nodes"].append(node(6, "aStarLayered", "route/search.ts", [1]))
        self.p["nodes"].append(node(7, "unrelated", "other.ts"))
        self.p["samples"].extend([6, 7])
        self.p["timeDeltas"].extend([0, 9])
        r = partition(self.p)
        self.assertEqual(r["owner_us"]["outside search"], {"other.ts:0 / unrelated": {"self_us": 9, "descendant_us": 0}})
        self.assertEqual(r["owner_us"]["search remainder"]["route/search.ts:0 / aStarLayered"], {"self_us": 0, "descendant_us": 0})
        self.assertEqual(r["owner_us"]["quilt remainder"], {"route/quilt.ts:0 / state": {"self_us": 2, "descendant_us": 0}})
        self.assertEqual(sum(sum(sum(w.values()) for w in e.values()) for e in r["owner_us"].values()), 24)

    def test_corruption(self):
        mutations = [lambda p: p["nodes"].append(copy.deepcopy(p["nodes"][0])), lambda p: p["nodes"][0]["children"].append(999), lambda p: p["nodes"][4]["children"].append(1), lambda p: p["samples"].append(1), lambda p: p["samples"].__setitem__(0, 999), lambda p: p["timeDeltas"].__setitem__(0, -1), lambda p: p["timeDeltas"].__setitem__(0, float("nan"))]
        for mutate in mutations:
            p = copy.deepcopy(self.p)
            mutate(p)
            with self.assertRaises(ValueError):
                partition(p)


if __name__ == "__main__":
    unittest.main()
