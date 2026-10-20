"""Replay the native-clean embedded-rule control without executing native checking."""
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
before = json.loads((root / 'outlined-before/results.json').read_text())
after = json.loads((root / 'outlined-after/results.json').read_text())
assert len(before) == len(after) == 3
for a, b in zip(before, after):
    repeat = a['repeat']
    assert b['repeat'] == repeat and a['accepted'] and not b['accepted']
    assert a['newErrors'] == a['opens'] == 0
    assert b['error'] == 'Error: Candidate embedded board rules differ from input'
    original = root / f'outlined-before/before-{repeat}.kicad_pcb'
    candidate = root / f'outlined-before/after-{repeat}.kicad_pcb'
    assert original.read_text().replace('(pad_to_mask_clearance 0.2)', '(pad_to_mask_clearance 0)') == candidate.read_text()
    report = json.loads((root / f'outlined-before/report-{repeat}.json').read_text())
    assert report['accepted']
    for label, path in [('input', original), ('candidate', candidate)]:
        assert hashlib.sha256(path.read_bytes()).hexdigest() == report[label + 'Sha256']
        assert not report[label + 'Report']['violations']
        assert not report[label + 'Report']['unconnected_items']
        assert (root / f'outlined-after/{path.name}').read_bytes() == path.read_bytes()
        assert path.with_suffix('.kicad_pro').read_bytes() == b'{}'
        assert (root / f'outlined-after/{path.name}').with_suffix('.kicad_pro').read_bytes() == b'{}'
print('PASS: same outlined boards, project bytes, zero findings/opens; changed setup accepted 3/3 before and blocked 3/3 after')
