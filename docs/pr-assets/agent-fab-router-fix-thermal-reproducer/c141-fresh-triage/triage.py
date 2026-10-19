"""Read-only triage of two completed runs; no routing, refill or scoring changes."""
import argparse
import collections
import hashlib
import json
from pathlib import Path


def load(path):
    summary = json.loads((path / "summary.json").read_text())
    assert summary["complete"] and summary["controls_preserved"] and not summary["smoke"]
    rows = [r for r in json.loads((path / "results.json").read_text()) if r["router"] == "fab-router"]
    keyed = {(r["case"], r["seed"]): r for r in rows}
    assert len(rows) == len(keyed) == 78, "missing or duplicate engine runs"
    cases = sorted({r["case"] for r in rows})
    assert len(cases) == 26
    for case in cases:
        assert {seed for name, seed in keyed if name == case} == {1, 2, 3}
    for row in rows:
        assert row["status"] == "checked", "unvalidated route"
        check = row["check"]
        assert check["integrity_pass"] and all(check["integrity_checks"].values())
        assert check["native_version"] == "10.0.6"
        assert row["new_errors"] == len(check["new_error_details"])
    return keyed


def classify(row):
    if row["new_errors"]:
        return "new-native-errors"  # Priority over simultaneous opens.
    if row["opens"]:
        return "opens-only"
    assert row["passed"], "unclassified failure"
    return "passed"


def audit(before, after):
    assert before.keys() == after.keys(), "different case/seed sets"
    fields = ["status", "passed", "opens", "new_errors", "new_error_types", "failed_fidelity", "vias", "length_mm"]
    changed = [list(key) for key in sorted(before) if any(before[key][f] != after[key][f] for f in fields)]
    def witnesses(row):
        return sorted(json.dumps(error, sort_keys=True) for error in row["check"]["new_error_details"])

    changed_witnesses = [list(key) for key in sorted(before) if witnesses(before[key]) != witnesses(after[key])]
    cases = []
    for case in sorted({key[0] for key in after}):
        rows = [after[case, seed] for seed in [1, 2, 3]]
        # Do not merge different native pad/zone identities or hide repeat variation.
        witnesses = []
        for row in rows:
            witnesses.append({"seed": row["seed"], "errors": row["check"]["new_error_details"]})
        cases.append({"case": case, "classification": [classify(r) for r in rows],
                      "opens": [r["opens"] for r in rows], "new_errors": [r["new_errors"] for r in rows],
                      "native_witnesses": witnesses if any(r["new_errors"] for r in rows) else []})
    return {"changed_case_seeds": changed, "compared_fields": fields, "changed_native_witness_case_seeds": changed_witnesses,
            "classification_counts": dict(collections.Counter(classify(r) for r in after.values())),
            "cases": cases,
            "scope": "Existing completed runs only; not a new router benchmark or repair. Open blockage causes remain unproven."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    args = parser.parse_args()
    report = audit(load(args.before), load(args.after))
    report["input_sha256"] = {label: {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
                                        for name in ["summary.json", "results.json", "controls.json"]}
                               for label, root in [("before", args.before), ("after", args.after)]}
    print(json.dumps(report, indent=2, sort_keys=True))
