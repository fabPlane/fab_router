"""Disjoint sampled search costs; does not run routing or estimate speedups."""

import collections
import gzip
import hashlib
import json
from pathlib import Path
import math
import sys


def partition(profile):
    nodes = {n["id"]: n for n in profile["nodes"]}
    if len(nodes) != len(profile["nodes"]):
        raise ValueError("duplicate node")
    parents = {}
    for n in nodes.values():
        for child in n.get("children", []):
            if child not in nodes or child in parents:
                raise ValueError("invalid child")
            parents[child] = n["id"]
    stacks = {}
    for ident in nodes:
        chain, seen, current = [], set(), ident
        while True:
            if current in seen:
                raise ValueError("cycle")
            seen.add(current)
            f = nodes[current]["callFrame"]
            chain.append((f["functionName"], f["url"].replace("\\", "/").split("/src/")[-1]))
            if current not in parents:
                break
            current = parents[current]
        stacks[ident] = chain
    if len(profile["samples"]) != len(profile["timeDeltas"]):
        raise ValueError("sample count")
    groups = collections.Counter()
    contexts = collections.Counter()
    for ident, delta in zip(profile["samples"], profile["timeDeltas"]):
        if ident not in stacks or not isinstance(delta, (int, float)) or not math.isfinite(delta) or delta < 0:
            raise ValueError("invalid sample")
        chain = stacks[ident]
        search = next((i for i, (name, path) in enumerate(chain) if path == "route/search.ts" and name in ("aStar", "aStarLayered")), None)
        group = "outside search"
        if search is not None:
            group = "search remainder"
            # The nearest recognized subsystem owns the sample, including
            # unrecognized descendants. This prevents inclusive double counting.
            for name, path in chain[:search]:
                if path.startswith("geom/") or path == "route/clear.ts":
                    group = "geometry and clearance"
                elif path == "lattice/grid.ts":
                    group = "lattice"
                elif path == "route/quilt.ts":
                    group = "quilt remainder"
                elif path == "route/search.ts" and name in ("probe", "hash", "gOr", "leq", "parentOf", "put"):
                    group = "visited table"
                elif path == "route/search.ts" and name in ("pop", "push", "less", "swap"):
                    group = "frontier heap"
                else:
                    continue
                break
        groups[group] += delta
        contexts[(chain[search][0] if search is not None else "outside search") + " / " + group] += delta
    return {"samples": len(profile["samples"]), "sampled_us": sum(profile["timeDeltas"]), "disjoint_us": dict(sorted(groups.items())), "context_us": dict(sorted(contexts.items()))}


def main():
    root = Path(__file__).resolve().parent
    result = {}
    for path in sorted(root.glob("*.cpuprofile.gz")):
        raw = path.read_bytes()
        result[path.name] = {"sha256": hashlib.sha256(raw).hexdigest(), **partition(json.loads(gzip.decompress(raw)))}
    if len(result) != 3:
        raise ValueError("expected three retained profiles")
    Path(sys.argv[1]).write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
