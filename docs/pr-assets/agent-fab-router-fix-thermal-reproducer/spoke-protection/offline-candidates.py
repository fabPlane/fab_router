#!/usr/bin/python3
"""Fixture-only native acceptance experiment on private staged files.

Never installs candidates in a live document. No general rule validator or atomic
publication/ownership protocol is provided. Reports all native errors verbatim.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
PARENT = HERE.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def errors(report):
    return [v for v in report['violations'] if v['severity'] == 'error']


def check(board, report):
    command = ['kicad-cli', 'pcb', 'drc', '--refill-zones', '--save-board',
               '--severity-all', '--format', 'json', '-o', str(report), str(board)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=90)
    report.with_suffix('.log').write_text(result.stdout + result.stderr)
    assert result.returncode == 0, result.stderr
    data = json.loads(report.read_text())
    assert data['kicad_version'] == '10.0.6'
    return data


def stage(source, folder):
    folder.mkdir()
    board = folder / 'board.kicad_pcb'
    shutil.copyfile(source, board)
    for ext in ('kicad_pro', 'kicad_dru'):
        shutil.copyfile(PARENT / ('thermal.' + ext), board.with_suffix('.' + ext))
    return board


def run(out):
    out.mkdir(parents=True, exist_ok=False)
    sources = [PARENT / 'route-input.kicad_pcb', PARENT / 'thermal.kicad_pro',
               PARENT / 'thermal.kicad_dru'] + [HERE / 'reports' / f'1-{v}-after.kicad_pcb'
                                               for v in ('baseline', 'protected')]
    initial = {str(p): digest(p) for p in sources}
    rows = []
    for repeat in range(1, 4):
        for variant in ('bad-thermal', 'protected', 'invalid-rules', 'missing-project'):
            folder = out / f'{repeat}-{variant}'
            folder.mkdir()
            before = stage(sources[0], folder / 'before')
            candidate_source = sources[-2] if variant == 'bad-thermal' else sources[-1]
            candidate = stage(candidate_source, folder / 'candidate')
            if variant == 'invalid-rules':
                candidate.with_suffix('.kicad_dru').write_text(
                    '(version 1)\n(rule "invalid" (constraint no_such_constraint (min 0.3mm)))\n')
            if variant == 'missing-project':
                candidate.with_suffix('.kicad_pro').unlink()
            # Fixture-specific precondition: a matching project is mandatory.
            # This intentionally does not model projects which legitimately need no sidecar.
            project_present = candidate.with_suffix('.kicad_pro').is_file()
            original = {str(p): digest(p) for p in sources}
            # Probe rules in a separate disposable copy, never filter induced errors
            # out of the actual candidate report.
            probe = folder / 'loading-probe'
            shutil.copytree(candidate.parent, probe)
            probe_board = probe / 'board.kicad_pcb'
            with probe_board.with_suffix('.kicad_dru').open('a') as stream:
                stream.write('\n(rule "loading sentinel" (constraint disallow track))\n')
            probe_data = check(probe_board, probe / 'native.json')
            sentinel_errors = [v for v in errors(probe_data) if v['type'] == 'items_not_allowed'
                               and "rule 'loading sentinel'" in v['description']]
            loading_observed = bool(sentinel_errors)
            baseline_data = check(before, before.parent / 'native.json')
            candidate_data = check(candidate, candidate.parent / 'native.json')
            # Zero baseline errors in this fixture permits exact added-error rejection,
            # without assuming that equal per-rule error counts imply preservation.
            assert not errors(baseline_data)
            candidate_errors = errors(candidate_data)
            accepted = project_present and loading_observed and not candidate_errors
            assert accepted == (variant == 'protected'), (variant, candidate_errors)
            assert len(candidate_errors) == (1 if variant == 'bad-thermal' else 0)
            if candidate_errors:
                assert candidate_errors[0]['type'] == 'starved_thermal'
            assert len(baseline_data['unconnected_items']) == 2
            assert len(candidate_data['unconnected_items']) == 1
            assert original == {str(p): digest(p) for p in sources}
            rows.append(dict(repeat=repeat, variant=variant, accepted=accepted,
                             baseline_errors=0, candidate_errors=len(candidate_errors),
                             baseline_opens=2, candidate_opens=1,
                             project_present=project_present, loading_observed=loading_observed,
                             original_files_unchanged=True,
                             candidate_input_sha256=digest(candidate_source),
                             candidate_refilled_sha256=digest(candidate),
                             native_report_sha256=digest(candidate.parent / 'native.json')))
    assert initial == {str(p): digest(p) for p in sources}
    # Use repository-relative names for public evidence.
    source_hashes = {str(p.relative_to(HERE.parents[3])): digest(p) for p in sources}
    result = dict(repeats=3, routing_benchmark=False, production_fix=False,
                  native_version='10.0.6', script_sha256=digest(Path(__file__)),
                  source_hashes=source_hashes, rows=rows)
    (out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print('12 offline candidate checks passed; no original files modified or candidates published.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    run(parser.parse_args().out.resolve())
