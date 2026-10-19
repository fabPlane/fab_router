import copy
from decimal import Decimal
import unittest
from probe import proposals, m

class NativeCoordinates(unittest.TestCase):
    def test_serialized_coordinates_are_integral_nanometres(self):
        nodes=['kicad_pcb',['segment',['start','0','0'],['end','4','2'],['width','.2'],['layer','"B.Cu"'],['net','1'],['uuid','"test"']]]
        before=copy.deepcopy(nodes)
        candidates=list(proposals(nodes,'test'))
        self.assertEqual(len(candidates),8)
        self.assertEqual(nodes,before)
        for data in candidates:
            tracks=m.native.parse(data.decode())[1:]
            for track in tracks:
                for key in ('start','end'):
                    for v in m.native.child(track,key)[1:3]:
                        nm=Decimal(v)*1000000
                        self.assertEqual(nm,nm.to_integral_value())
if __name__=='__main__':unittest.main()
