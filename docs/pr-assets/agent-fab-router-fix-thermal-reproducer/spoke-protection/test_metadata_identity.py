"""Regression controls for diagnostic metadata identity, not a native safety guard."""
import importlib.util
import json
import pathlib
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('identity', HERE / 'metadata_identity.py')
identity = importlib.util.module_from_spec(spec)
if spec.loader:
    spec.loader.exec_module(identity)


class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.board = pathlib.Path(self.temp.name) / 'board.kicad_pcb'
        self.board.write_bytes(b'board bytes')
        self.board.with_suffix('.kicad_pro').write_bytes(b'project bytes')
        self.board.with_suffix('.kicad_dru').write_bytes(b'rule bytes')
        self.manifest = identity.capture(self.board, '10.0.6')

    def test_unchanged_bundle(self):
        identity.validate(self.manifest, self.board, '10.0.6')

    def test_stale_board(self):
        self.board.write_bytes(b'changed board')
        with self.assertRaisesRegex(ValueError, 'board'):
            identity.validate(self.manifest, self.board, '10.0.6')

    def test_stale_project(self):
        self.board.with_suffix('.kicad_pro').write_bytes(b'changed minimum')
        with self.assertRaisesRegex(ValueError, 'project'):
            identity.validate(self.manifest, self.board, '10.0.6')

    def test_missing_project(self):
        self.board.with_suffix('.kicad_pro').unlink()
        with self.assertRaisesRegex(ValueError, 'project'):
            identity.validate(self.manifest, self.board, '10.0.6')

    def test_stale_rules(self):
        self.board.with_suffix('.kicad_dru').write_bytes(b'changed rules')
        with self.assertRaisesRegex(ValueError, 'rules'):
            identity.validate(self.manifest, self.board, '10.0.6')

    def test_new_rules_after_snapshot(self):
        self.board.with_suffix('.kicad_dru').unlink()
        manifest = identity.capture(self.board, '10.0.6')
        self.board.with_suffix('.kicad_dru').write_bytes(b'new rules')
        with self.assertRaisesRegex(ValueError, 'rules'):
            identity.validate(manifest, self.board, '10.0.6')

    def test_native_version(self):
        with self.assertRaisesRegex(ValueError, 'native_version'):
            identity.validate(self.manifest, self.board, '10.0.7')

    def test_renamed_identical_bundle(self):
        other = self.board.with_name('renamed.kicad_pcb')
        for suffix in ('.kicad_pcb', '.kicad_pro', '.kicad_dru'):
            other.with_suffix(suffix).write_bytes(self.board.with_suffix(suffix).read_bytes())
        identity.validate(json.loads(json.dumps(self.manifest)), other, '10.0.6')

    def test_missing_project_is_explicit(self):
        self.board.with_suffix('.kicad_pro').unlink()
        manifest = identity.capture(self.board, '10.0.6')
        self.assertIsNone(manifest['project'])
        identity.validate(manifest, self.board, '10.0.6')
        self.board.with_suffix('.kicad_pro').write_bytes(b'new project')
        with self.assertRaisesRegex(ValueError, 'project'):
            identity.validate(manifest, self.board, '10.0.6')


if __name__ == '__main__':
    unittest.main(verbosity=2)
