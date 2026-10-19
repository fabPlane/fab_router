#!/usr/bin/python3
"""Fixture-only checked-board receipt; no publication or atomic ownership claim.

The checker intentionally refills/saves its input. Capture the receipt AFTER that
process exits. Reject persistent board/report/sidecar drift before accepting.
The final hash comparison is not an atomic check-and-publish operation.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('identity', HERE / 'staged-identity.py')
identity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(identity)
offline = identity.offline


def receipt(board, report):
    paths = dict(board=board, report=report,
                 project=board.with_suffix('.kicad_pro'),
                 rules=board.with_suffix('.kicad_dru'))
    return {key: offline.digest(path) if path.is_file() else None
            for key, path in paths.items()}


def run(out, enforce):
    out.mkdir(parents=True, exist_ok=False)
    protected = HERE / 'reports/1-protected-after.kicad_pcb'
    unsafe = HERE / 'reports/1-baseline-after.kicad_pcb'
    sources = [protected, unsafe, offline.PARENT / 'thermal.kicad_pro',
               offline.PARENT / 'thermal.kicad_dru']
    originals = {str(p): offline.digest(p) for p in sources}
    rows = []
    for repeat in range(1, 4):
        for variant in ('unchanged', 'board-whitespace', 'unsafe-board', 'report-whitespace'):
            folder = out / f'{repeat}-{variant}'
            folder.mkdir()
            board = offline.stage(protected, folder / 'candidate')
            expected_sidecars = identity.sidecars(board)
            probe = folder / 'loading-probe'
            shutil.copytree(board.parent, probe)
            with (probe / 'board.kicad_dru').open('a') as stream:
                stream.write('\n(rule "loading sentinel" (constraint disallow track))\n')
            probe_data = offline.check(probe / 'board.kicad_pcb', probe / 'native.json')
            loading = any(v['type'] == 'items_not_allowed' and
                          "rule 'loading sentinel'" in v['description']
                          for v in offline.errors(probe_data))
            before_sidecars = identity.sidecars(board)
            report = board.parent / 'native.json'
            checked = offline.check(board, report)
            checked_receipt = receipt(board, report)
            # Faults occur after a clean native result, before the acceptance decision.
            if variant == 'unsafe-board':
                shutil.copyfile(unsafe, board)
            elif variant in ('board-whitespace', 'report-whitespace'):
                target = board if variant == 'board-whitespace' else report
                with target.open('a') as stream:
                    stream.write('\n')
            decision_receipt = receipt(board, report)
            previous = (loading and not offline.errors(checked) and
                        expected_sidecars == before_sidecars == identity.sidecars(board))
            stable = checked_receipt == decision_receipt
            accepted = previous and (stable if enforce else True)
            # Recheck a copy of the DECISION bytes, never overwrite the receipt evidence.
            verification = folder / 'verification'
            shutil.copytree(board.parent, verification)
            verified = offline.check(verification / 'board.kicad_pcb', verification / 'native.json')
            errors = offline.errors(verified)
            assert previous and not offline.errors(checked)
            assert len(errors) == (1 if variant == 'unsafe-board' else 0)
            if errors:
                assert errors[0]['type'] == 'starved_thermal'
            rows.append(dict(repeat=repeat, variant=variant, previous_decision=previous,
                             accepted=accepted, stable_receipt=stable, checked_errors=0,
                             decision_board_errors=len(errors),
                             decision_board_opens=len(verified['unconnected_items']),
                             checked_receipt=checked_receipt, decision_receipt=decision_receipt))
    assert originals == {str(p): offline.digest(p) for p in sources}
    result = dict(repeats=3, enforce_receipt=enforce, production_fix=False,
                  routing_benchmark=False, candidates_published=False,
                  original_sources_unchanged=True,
                  script_sha256=offline.digest(Path(__file__)), rows=rows)
    (out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    # A legacy run deliberately fails this regression after recording every result.
    assert all(row['accepted'] == (row['variant'] == 'unchanged') for row in rows)
    print('12 checked-board receipt controls passed; no candidates published.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--legacy', action='store_true', help='reproduce the previous acceptance failure')
    args = parser.parse_args()
    run(args.out.resolve(), not args.legacy)
