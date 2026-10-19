#!/usr/bin/python3
"""A checked design must be exactly one complete S-expression."""
import argparse
import importlib.util
import json
from pathlib import Path
import native
import transaction
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--parser-source', type=Path, help='Replay the same controls against a retained parser module')
args=parser.parse_args()
if args.parser_source:
    spec=importlib.util.spec_from_file_location('reference_parser',args.parser_source)
    reference=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    native.parse=reference.parse
identity = transaction.module('parser_identity', 'design-identity.py')
valid = [
    '(kicad_pcb (version 20260101))',
    ' \n(kicad_pcb (property "quoted (parentheses)" "escaped \\\" quote"))\t',
    '(kicad_pcb (segment (start -1.0 2) (end 3 4)))',
]
invalid = {
    'two-boards': '(kicad_pcb (version 1)) (kicad_pcb (version 2))',
    'hidden-changed-board': '(kicad_pcb (net 1 "changed")) (kicad_pcb (net 1 "original"))',
    'unclosed-after-board': '(kicad_pcb) (',
    'unclosed-parent': '((kicad_pcb)',
    'trailing-atom': '(kicad_pcb) changed',
    'leading-atom': 'changed (kicad_pcb)',
    'extra-close': '(kicad_pcb))',
    'empty': '',
    'unterminated-quote': '(kicad_pcb (property "unterminated))',
}
rows=[]
for repeat in range(1,4):
    for index, source in enumerate(valid):
        try:
            parsed=native.parse(source)
            assert native.parse(native.dump(parsed)) == parsed
            assert identity.design_signature(source.encode()) == identity.design_signature(native.dump(parsed).encode())
            passed=True
        except Exception:
            passed=False
        rows.append(dict(repeat=repeat,case=f'valid-{index}',passed=passed))
    for name, source in invalid.items():
        try:
            native.parse(source)
            passed=False
        except ValueError:
            try:
                identity.design_signature(source.encode())
                passed=False
            except ValueError:
                passed=True
        except Exception:
            passed=False
        rows.append(dict(repeat=repeat,case=name,passed=passed))
print(json.dumps(rows,indent=2))
assert all(row['passed'] for row in rows), 'ambiguous or malformed native evidence accepted'
