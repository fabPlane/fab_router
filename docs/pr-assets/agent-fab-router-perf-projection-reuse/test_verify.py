# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import json, shutil, tempfile, unittest
import verify
class VerificationTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.p=Path(self.temp.name)/'evidence';shutil.copytree(Path(__file__).resolve().parent,self.p)
 def rewrite(self,name,edit):
  p=self.p/name;j=json.loads(p.read_text());edit(j);p.write_text(json.dumps(j)+'\n')
 def test_original(self):verify.validate(self.p)
 def test_checksum(self):
  with (self.p/'probe.log').open('a')as f:f.write('corrupt')
  with self.assertRaisesRegex(ValueError,'checksum'):verify.validate(self.p)
 def test_omitted_manifest_member(self):
  self.rewrite('manifest.json',lambda j:j.pop('probe.log'))
  with self.assertRaisesRegex(ValueError,'manifest membership'):verify.validate(self.p)
 def test_empty_manifest(self):
  self.rewrite('manifest.json',lambda j:j.clear())
  with self.assertRaisesRegex(ValueError,'manifest membership'):verify.validate(self.p)
 def test_missing_file(self):
  (self.p/'probe.log').unlink()
  with self.assertRaisesRegex(ValueError,'manifest membership'):verify.validate(self.p)
 def test_unlisted_file(self):
  (self.p/'unlisted.txt').write_text('unlisted')
  with self.assertRaisesRegex(ValueError,'manifest membership'):verify.validate(self.p)
 def test_schedule(self):
  self.rewrite('timings.json',lambda j:j.reverse())
  with self.assertRaisesRegex(ValueError,'schedule'):verify.validate(self.p,False)
 def test_timing(self):
  self.rewrite('timings.json',lambda j:j[0].update(seconds=0))
  with self.assertRaisesRegex(ValueError,'timing mismatch'):verify.validate(self.p,False)
 def test_summary(self):
  self.rewrite('summary.json',lambda j:j[0]['control'].update(median=-1))
  with self.assertRaisesRegex(ValueError,'summary mismatch'):verify.validate(self.p,False)
 def test_reference_session(self):
  p=self.p/'reference'/verify.CASES[0]/'board.ses';p.write_bytes(p.read_bytes()+b'\n')
  with self.assertRaisesRegex(ValueError,'session'):verify.validate(self.p,False)
 def test_reference_report(self):
  self.rewrite(Path('reference')/verify.CASES[0]/'router-summary.json',lambda j:j['result']['report'].update(incompleteAfter=-1))
  with self.assertRaisesRegex(ValueError,'settings/results/report'):verify.validate(self.p,False)
if __name__=='__main__':unittest.main()
