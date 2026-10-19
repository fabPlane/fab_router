#!/usr/bin/python3
"""Fixture diagnostic: reject sidecar drift between loading probe and DRC.

Hash comparisons detect persistent changes only; they provide no locking,
atomic publication, transient-change detection, or live-editor ownership.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('offline', HERE / 'offline-candidates.py')
offline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offline)


def sidecars(board):
    return {ext: offline.digest(board.with_suffix('.' + ext))
            if board.with_suffix('.' + ext).is_file() else None
            for ext in ('kicad_pro', 'kicad_dru')}


def run(out):
    out.mkdir(parents=True, exist_ok=False)
    rows = []
    source = HERE / 'reports/1-protected-after.kicad_pcb'
    sources = [source, offline.PARENT / 'thermal.kicad_pro', offline.PARENT / 'thermal.kicad_dru']
    original = {str(p): offline.digest(p) for p in sources}
    for repeat in range(1, 4):
        for variant in ('unchanged', 'changed-rules', 'changed-project', 'deleted-rules'):
            folder = out / f'{repeat}-{variant}'
            folder.mkdir()
            candidate = offline.stage(source, folder / 'candidate')
            expected = sidecars(candidate)
            probe = folder / 'loading-probe'
            shutil.copytree(candidate.parent, probe)
            with (probe / 'board.kicad_dru').open('a') as stream:
                stream.write('\n(rule "loading sentinel" (constraint disallow track))\n')
            probe_data = offline.check(probe / 'board.kicad_pcb', probe / 'native.json')
            loading = any(v['type'] == 'items_not_allowed' and
                          "rule 'loading sentinel'" in v['description']
                          for v in offline.errors(probe_data))
            # Deliberate persistent drift AFTER the successful probe. Whitespace
            # changes retain semantics, so rejection cannot rely on added errors.
            if variant in ('changed-rules', 'changed-project'):
                ext = 'kicad_dru' if variant == 'changed-rules' else 'kicad_pro'
                with candidate.with_suffix('.' + ext).open('a') as stream:
                    stream.write('\n')
            elif variant == 'deleted-rules':
                candidate.with_suffix('.kicad_dru').unlink()
            before_drc = sidecars(candidate)
            report = candidate.parent / 'native.json'
            data = offline.check(candidate, report)
            after_drc = sidecars(candidate)
            legacy = candidate.with_suffix('.kicad_pro').is_file() and loading and not offline.errors(data)
            stable = expected == before_drc == after_drc
            accepted = legacy and stable
            assert loading and not offline.errors(data)
            assert legacy and accepted == (variant == 'unchanged')
            assert len(data['unconnected_items']) == 1
            rows.append(dict(repeat=repeat, variant=variant, loading_observed=loading,
                             native_errors=len(offline.errors(data)), native_opens=1,
                             previous_decision=legacy, stable_sidecars=stable, accepted=accepted,
                             probed_sidecars=expected, before_drc_sidecars=before_drc,
                             after_drc_sidecars=after_drc,
                             refilled_board_sha256=offline.digest(candidate),
                             report_sha256=offline.digest(report)))
    assert original == {str(p): offline.digest(p) for p in sources}
    result = dict(repeats=3, routing_benchmark=False, production_fix=False,
                  script_sha256=offline.digest(Path(__file__)),
                  helper_sha256=offline.digest(HERE / 'offline-candidates.py'),
                  original_sources_unchanged=True, rows=rows)
    (out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print('12 staged identity controls passed; no candidates published.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    run(parser.parse_args().out.resolve())
