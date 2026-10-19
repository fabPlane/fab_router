"""The native validation boundary must reject changes to source design metadata."""
import argparse
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

assets=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(assets/'aquarius-reduced'))
import transaction
p=argparse.ArgumentParser(add_help=False)
p.add_argument('--before',action='store_true');args,remaining=p.parse_known_args()
sys.argv=[sys.argv[0]]+remaining
if args.before:
    # Keep historical relative imports bound to their actual dependency directory.
    spec=importlib.util.spec_from_loader('old_transaction',loader=None)
    transaction=importlib.util.module_from_spec(spec)
    transaction.__file__=str(assets/'aquarius-reduced/transaction.py')
    exec(compile((assets/'c184-source-guard/transaction-before.py').read_text(),transaction.__file__,'exec'),transaction.__dict__)

SOURCE=b'''(kicad_pcb (version 20260101) (net 1 "GND")
(footprint "R" (at 1 2) (uuid fp) (pad "1" smd rect (at 0 0) (size 1 1) (uuid pad)))
(zone (net 1) (uuid zone) (thermal_gap 0.2) (polygon (pts (xy 0 0) (xy 2 0) (xy 2 2))) (filled_polygon (pts (xy 0 0))))
(gr_line (start 0 0) (end 2 2) (uuid edge))
(segment (start 1 2) (end 3 4) (net 1) (uuid track)))'''

class SourceGuard(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.source=self.root/'source.kicad_pcb'
        self.source.write_bytes(SOURCE)
        for ext in ('.kicad_pro','.kicad_dru'):self.source.with_suffix(ext).write_bytes(b'fixed rules')
        self.calls=0
        def check(nodes,name):
            self.calls+=1
            out=self.root/name;out.mkdir()
            (out/'board.kicad_pcb').write_text(transaction.native.dump(nodes)+'\n')
            for ext in ('.kicad_pro','.kicad_dru'):(out/('board'+ext)).write_bytes(b'fixed rules')
            return dict(errors=[],opens=0)
        for obj,key,value in ((transaction.native,'SRC',self.source),(transaction.native,'D',self.root),(transaction.native,'check',check),(transaction.native.pcbnew,'LoadBoard',lambda _:None),(transaction.terminals,'partition',lambda _:{})):
            patcher=patch.object(obj,key,value);patcher.start();self.addCleanup(patcher.stop)

    def reject(self,data):
        with self.assertRaisesRegex(ValueError,'source metadata'):
            transaction.checked_native(data,'candidate')
        self.assertEqual(self.calls,0,'Reject before running native checker')
        self.assertEqual(self.source.read_bytes(),SOURCE)

    def test_moved_footprint_rejected(self):self.reject(SOURCE.replace(b'(at 1 2)',b'(at 2 2)'))
    def test_changed_pad_size_rejected(self):self.reject(SOURCE.replace(b'(size 1 1)',b'(size 2 2)'))
    def test_changed_thermal_rule_rejected(self):self.reject(SOURCE.replace(b'(thermal_gap 0.2)',b'(thermal_gap 0.3)'))
    def test_changed_net_name_rejected(self):self.reject(SOURCE.replace(b'"GND"',b'"POWER"'))
    def test_removed_outline_rejected(self):self.reject(SOURCE.replace(b'(gr_line (start 0 0) (end 2 2) (uuid edge))',b''))
    def test_added_zone_rejected(self):self.reject(SOURCE[:-1]+b'(zone (net 1) (uuid other)))')
    def test_copper_edit_remains_native_checked(self):
        data=SOURCE.replace(b'(end 3 4)',b'(end 4 4)')
        self.assertEqual(transaction.checked_native(data,'candidate')['errors'],[])
        self.assertEqual(self.calls,1)
    def test_refill_and_numeric_formatting_allowed(self):
        data=SOURCE.replace(b'(filled_polygon (pts (xy 0 0)))',b'(filled_polygon (pts (xy 1 1)))').replace(b'(at 1 2)',b'(at 1.000 2.0)')
        transaction.checked_native(data,'candidate');self.assertEqual(self.calls,1)
    def test_transaction_restores_exact_bytes_on_metadata_rejection(self):
        baseline=dict(errors=[{'type':'starved_thermal'}],groups={},opens=0)
        candidate=SOURCE.replace(b'(thermal_gap 0.2)',b'(thermal_gap 0.3)')
        output,accepted,row,exception=transaction.transact(SOURCE,candidate,baseline,lambda d:transaction.checked_native(d,'candidate'))
        self.assertEqual(output,SOURCE);self.assertFalse(accepted)
        self.assertEqual(exception,'ValueError');self.assertIsNone(row)

if __name__=='__main__':unittest.main()
