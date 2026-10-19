#!/usr/bin/python3
"""Exercise both offline search entrypoints with native escaped net names."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import native
import transaction


class NetNames(unittest.TestCase):
    def test_entrypoints(self):
        pcb = native.pcbnew
        for filename in ('thermal-links.py', 'thermal-doglegs.py'):
            for name in ('GNDD', 'quoted"net', r'path\net', 'both\\"net', 'signal µ'):
                with self.subTest(helper=filename, net=name), tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    helper = transaction.module('net_test_' + filename.replace('-', '_'), filename)
                    board = pcb.BOARD()
                    net = pcb.NETINFO_ITEM(board, name, 1)
                    board.Add(net)
                    footprint = pcb.FOOTPRINT(board)
                    board.Add(footprint)
                    pad = pcb.PAD(footprint)
                    footprint.Add(pad)
                    pad.SetNet(net)
                    layers = pcb.LSET()
                    layers.AddLayer(pcb.B_Cu)
                    pad.SetLayerSet(layers)
                    zone = pcb.ZONE(board)
                    zone.SetLayerSet(layers)
                    zone.SetNet(net)
                    zone.SetThermalReliefGap(508000)
                    outline = zone.Outline()
                    outline.NewOutline()
                    for x, y in ((-2000000, -2000000), (2000000, -2000000), (2000000, 2000000), (-2000000, 2000000)):
                        outline.Append(x, y)
                    board.Add(zone)
                    source = root / 'board.kicad_pcb'
                    pcb.SaveBoard(str(source), board)
                    for suffix in ('.kicad_pro', '.kicad_dru'):
                        source.with_suffix(suffix).write_text('')
                    # Use the native loader to verify the serialized input name.
                    loaded = pcb.LoadBoard(str(source))
                    self.assertEqual(next(iter(loaded.GetPads())).GetNetname(), name)
                    calls = []

                    def transact(original, candidate, baseline, checker):
                        nodes = native.parse(candidate.decode())
                        segments = [n for n in nodes if isinstance(n, list) and n[0] == 'segment']
                        self.assertEqual(len(segments), 2 if 'doglegs' in filename else 1)
                        for segment in segments:
                            atom = native.child(segment, 'net')[1]
                            self.assertEqual(json.loads(atom), name)
                        # Also require the native reader to preserve net assignment.
                        candidate_path = root / 'candidate.kicad_pcb'
                        candidate_path.write_bytes(candidate)
                        parsed = pcb.LoadBoard(str(candidate_path))
                        self.assertEqual([t.GetNetname() for t in parsed.GetTracks()], [name] * len(segments))
                        calls.append(candidate)
                        return candidate, True, {}, None

                    argv = [filename, '--source', str(source), '--out', str(root / 'out'),
                            '--target', pad.m_Uuid.AsString()]
                    # Isolate metadata/proposal generation: this test does not run DRC.
                    with patch('sys.argv', argv), patch.object(transaction, 'checked_native', return_value={'target': True}), \
                            patch.object(transaction, 'transact', side_effect=transact), contextlib.redirect_stdout(io.StringIO()):
                        helper.main()
                    self.assertEqual(len(calls), 3)
                    self.assertEqual(len(set(calls)), 1)


if __name__ == '__main__':
    unittest.main()
