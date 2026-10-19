#!/usr/bin/env python3
"""Synthetic report regressions; these do not run native DRC or routing."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent

class SummaryControls(unittest.TestCase):
    def summarize(self, initial_opens, accepted_opens, rejected_opens):
        with tempfile.TemporaryDirectory(prefix='thermal-summary-control-') as directory:
            root = Path(directory)
            (root/'repeat-1').mkdir()
            selected = b'synthetic selected evidence; not a board'
            (root/'repeat-1'/'selected.kicad_pcb').write_bytes(selected)
            row = lambda errors, opens: dict(errors=[dict(type='starved_thermal', id=i) for i in range(errors)],
                                             opens=opens, groups={'pad':['pad']})
            run = dict(baseline=row(2, initial_opens), final=row(1, accepted_opens),
                       attempts=[dict(accepted=True, row=row(1, accepted_opens), exception=None),
                                 dict(accepted=False, row=row(0, rejected_opens), exception=None)],
                       stop='exhausted', skipped=[], selected_sha256=hashlib.sha256(selected).hexdigest())
            (root/'summary.json').write_text(json.dumps(dict(input_sha256={}, budget=2, rows=[run])))
            output = root/'comparison.json'
            subprocess.run([sys.executable, '-B', str(HERE/'summarize.py'), str(root), str(output)],
                           check=True, stdout=subprocess.DEVNULL, timeout=15)
            return json.loads(output.read_text())['repeats'][0]['rejected_reasons']

    def test_rejected_candidate_loses_previously_accepted_open_reduction(self):
        self.assertEqual(self.summarize(2, 1, 2), {'increased_opens':1})

    def test_candidate_above_original_open_count_is_still_reported(self):
        self.assertEqual(self.summarize(2, 1, 3), {'increased_opens':1})

    def test_equal_current_open_count_is_not_an_open_regression(self):
        self.assertEqual(self.summarize(2, 1, 1), {})

if __name__ == '__main__':
    unittest.main()
