#!/usr/bin/python3
"""Native metadata regressions for offline thermal proposal layer selection."""
import unittest
import native
import transaction


class PlaneLayers(unittest.TestCase):
    def test_layer_inventory(self):
        pcb = native.pcbnew
        cases = [
            ('back single', [pcb.B_Cu], [(1, [pcb.B_Cu])], '"B.Cu"'),
            ('back multilayer', [pcb.B_Cu], [(1, [pcb.F_Cu, pcb.B_Cu])], '"B.Cu"'),
            ('front multilayer', [pcb.F_Cu], [(1, [pcb.F_Cu, pcb.B_Cu])], '"F.Cu"'),
            ('duplicate planes', [pcb.B_Cu], [(1, [pcb.B_Cu]), (1, [pcb.F_Cu, pcb.B_Cu])], '"B.Cu"'),
            ('foreign plane', [pcb.B_Cu], [(2, [pcb.F_Cu, pcb.B_Cu])], None),
            ('disjoint plane', [pcb.B_Cu], [(1, [pcb.F_Cu])], None),
            ('ambiguous layers', [pcb.F_Cu, pcb.B_Cu], [(1, [pcb.F_Cu, pcb.B_Cu])], None),
            ('foreign ignored', [pcb.B_Cu], [(2, [pcb.F_Cu, pcb.B_Cu]), (1, [pcb.B_Cu])], '"B.Cu"'),
        ]
        for filename in ('thermal-links.py', 'thermal-doglegs.py'):
            helper = transaction.module('plane_test_' + filename.replace('-', '_'), filename)
            for name, pad_layers, zones, expected in cases:
                with self.subTest(helper=filename, case=name):
                    board = pcb.BOARD()
                    nets = {}
                    for code in (1, 2):
                        nets[code] = pcb.NETINFO_ITEM(board, 'N' + str(code), code)
                        board.Add(nets[code])
                    footprint = pcb.FOOTPRINT(board)
                    board.Add(footprint)
                    pad = pcb.PAD(footprint)
                    footprint.Add(pad)
                    pad.SetNet(nets[1])
                    layers = pcb.LSET()
                    for layer in pad_layers:
                        layers.AddLayer(layer)
                    pad.SetLayerSet(layers)
                    for code, zone_layers in zones:
                        zone = pcb.ZONE(board)
                        layers = pcb.LSET()
                        for layer in zone_layers:
                            layers.AddLayer(layer)
                        zone.SetLayerSet(layers)
                        zone.SetNet(nets[code])
                        board.Add(zone)
                        if len(zone_layers) > 1:
                            self.assertEqual(zone.GetLayer(), pcb.UNDEFINED_LAYER)
                    if expected is None:
                        with self.assertRaisesRegex(ValueError, 'one pad-connected plane layer required'):
                            helper.plane_layer(board, pad)
                    else:
                        self.assertEqual(helper.plane_layer(board, pad), expected)


if __name__ == '__main__':
    unittest.main()
