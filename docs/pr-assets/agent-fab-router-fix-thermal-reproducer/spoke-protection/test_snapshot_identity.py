"""Snapshot consistency controls with mutations during native property access."""
import importlib.util
import pathlib
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location('settings', HERE / 'native-settings.py')
settings = importlib.util.module_from_spec(spec)
spec.loader.exec_module(settings)


class SnapshotTests(unittest.TestCase):
    def snapshot(self, mutation=None):
        with tempfile.TemporaryDirectory() as directory:
            board_path = pathlib.Path(directory) / 'board.kicad_pcb'
            for suffix in ('.kicad_pcb', '.kicad_pro', '.kicad_dru'):
                board_path.with_suffix(suffix).write_bytes(b'original')

            def final_getter(pad):
                if mutation:
                    board_path.with_suffix(mutation).write_bytes(b'changed')
                return 0

            pad = types.SimpleNamespace(GetNetname=lambda: 'GND',
                GetLocalThermalGapOverride=lambda: None,
                GetLocalThermalSpokeWidthOverride=lambda: None)
            zone = types.SimpleNamespace(GetThermalReliefGap=lambda *args: final_getter(args[0]) if args else 508000,
                GetThermalReliefSpokeWidth=lambda: 508000)
            board = types.SimpleNamespace(GetPads=lambda: [pad], Zones=lambda: [zone],
                GetDesignSettings=lambda: types.SimpleNamespace(m_MinResolvedSpokes=2))
            native = types.SimpleNamespace(Version=lambda: '10.0.6', LoadBoard=lambda _: board)
            with patch.dict(sys.modules, pcbnew=native):
                return settings.snapshot(board_path)

    def test_unchanged(self):
        result = self.snapshot()
        self.assertEqual(result['board_min_resolved_spokes'], 2)
        self.assertEqual(result['zone_gap_with_pad_argument_nm'], 0)

    def test_board_changes_during_extraction(self):
        with self.assertRaisesRegex(ValueError, 'board'):
            self.snapshot('.kicad_pcb')

    def test_project_changes_during_extraction(self):
        with self.assertRaisesRegex(ValueError, 'project'):
            self.snapshot('.kicad_pro')

    def test_rules_change_during_extraction(self):
        with self.assertRaisesRegex(ValueError, 'rules'):
            self.snapshot('.kicad_dru')


if __name__ == '__main__':
    unittest.main(verbosity=2)
