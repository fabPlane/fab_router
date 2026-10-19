#!/usr/bin/python3
"""Prove a native thermal-setting distinction is absent from exported DSN.

Synthetic diagnostic controls only: never repairs or scores a benchmark board.
Only the zone thermal gap differs; native rules/checker are otherwise untouched.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import shutil
import sys
from audit import HERE, invoke


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalise(text, board):
    # Strip ONLY the exporter/session design filenames, not any routing data.
    for suffix in ('.dsn', '.ses'):
        text = text.replace('"' + str(board.with_suffix(suffix)) + '"', '"design' + suffix + '"')
    return text


def run(output):
    output.mkdir(parents=True, exist_ok=False)
    original = (HERE / 'route-input.kicad_pcb').read_text()
    token = '(thermal_gap 0.508)'
    assert original.count(token) == 1
    rows = []
    reference_dsn = reference_ses = None
    for repeat in range(1, 4):
        for label, gap, expected_errors in (
            ('original', '0.508', {'starved_thermal': 1}),
            ('gap-control', '0.254', {}),
        ):
            directory = output / f'{repeat}-{label}'
            directory.mkdir()
            before = directory / 'before.kicad_pcb'
            after = directory / 'after.kicad_pcb'
            modified = original.replace(token, f'(thermal_gap {gap})')
            # Prove the entire diagnostic input differs at this one field only.
            assert modified.replace(f'(thermal_gap {gap})', token) == original
            before.write_text(modified)
            for board in (before, after):
                for ext in ('kicad_pro', 'kicad_dru'):
                    shutil.copyfile(HERE / f'thermal.{ext}', board.with_suffix('.' + ext))
            invoke([sys.executable, HERE / 'audit.py', '--refill', before], directory, 'refill')
            dsn = normalise(before.with_suffix('.dsn').read_text(), before)
            invoke(['bun', HERE / 'route-input.ts', before.with_suffix('.dsn'),
                    directory / 'route.ses', directory / 'engine.json'], directory, 'route')
            ses = normalise((directory / 'route.ses').read_text(), before)
            if reference_dsn is None:
                reference_dsn, reference_ses = dsn, ses
            assert dsn == reference_dsn, 'DSN differs beyond the design filename'
            assert ses == reference_ses, 'SES differs beyond the design filenames'
            invoke([sys.executable, HERE / 'route-audit.py', '--import-session',
                    before, directory / 'route.ses', after], directory, 'import')
            native = {}
            for name, board in (('before', before), ('after', after)):
                report = directory / f'{name}.json'
                invoke(['kicad-cli', 'pcb', 'drc', '--severity-all', '--format', 'json',
                        '-o', report, board], directory, name + '-drc')
                drc = json.loads(report.read_text())
                errors = dict(collections.Counter(v['type'] for v in drc['violations']
                                                  if v['severity'] == 'error'))
                assert errors == ({} if name == 'before' else expected_errors), (label, name, errors)
                assert len(drc['unconnected_items']) == (2 if name == 'before' else 1)
                if name == 'after':
                    descriptions = [item['description'] for item in drc['unconnected_items'][0]['items']]
                    assert all('[Net-(LO(Q)1-Pad1)]' in text for text in descriptions), descriptions
                    assert any(text.startswith('Track [Net-(LO(Q)1-Pad1)]') for text in descriptions), descriptions
                native[name] = dict(errors=errors, unconnected=len(drc['unconnected_items']),
                                    violations=drc['violations'], unconnected_items=drc['unconnected_items'], report_sha256=sha(report.read_bytes()))
            engine = json.loads((directory / 'engine.json').read_text())
            assert engine['report']['incompleteAfter'] == 0
            assert engine['report']['violationsAdded'] == 0
            rows.append(dict(repeat=repeat, variant=label, thermal_gap_mm=gap,
                             input_sha256=sha(modified.encode()),
                             normalised_dsn_sha256=sha(dsn.encode()),
                             normalised_ses_sha256=sha(ses.encode()), native=native,
                             engine=engine))
    summary = dict(native_version='10.0.6', repeats=3, fixed=False, benchmark_score=False,
                   script_sha256=sha(pathlib.Path(__file__).read_bytes()),
                   note='Only synthetic zone thermal gap differs. Controls are not repairs. '
                        'Identical DSN/SES has different native thermal acceptance; one native open remains.',
                   rows=rows)
    (output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({key: value for key, value in summary.items() if key != 'rows'}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=pathlib.Path)
    run(parser.parse_args().out.resolve())
