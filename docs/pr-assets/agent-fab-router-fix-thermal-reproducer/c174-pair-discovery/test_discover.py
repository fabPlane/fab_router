import sys
from pathlib import Path
import unittest
import discover
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c171-marker-search'))
import search

def segment(uid,a,b,net='1',width='0.25',layer='"F.Cu"'):
    return ['segment',['start',*map(str,a)],['end',*map(str,b)],['net',net],['width',width],['layer',layer],['uuid','"'+uid+'"']]
class DiscoveryTests(unittest.TestCase):
    def test_discovery_filters_original_and_incompatible_pairs(self):
        pad=['footprint',['pad',['uuid','"pad"']]]
        a=segment('a',(0,0),(1,0));b=segment('b',(1,0),(1,1))
        nodes=[pad,a,b,segment('original',(1,0),(2,0)),segment('net',(1,0),(2,1),'2'),segment('width',(1,0),(2,2),width='0.5'),segment('layer',(1,0),(3,2),layer='"B.Cu"')]
        errors=[dict(type='starved_thermal',items=[dict(uuid='pad',pos=dict(x=0,y=0))])]
        self.assertEqual(discover.rank_pairs(nodes,{'original'},errors,8),[('a','b')])
        self.assertEqual(discover.rank_pairs(nodes,{'original'},[],8),[])
        self.assertEqual(discover.rank_pairs(list(reversed(nodes)),{'original'},errors,8),[('a','b')])
    def test_single_shared_endpoint_required(self):
        nodes=[['footprint',['pad',['uuid','"pad"']]],segment('a',(0,0),(1,0)),segment('b',(1,0),(0,0))]
        errors=[dict(type='starved_thermal',items=[dict(uuid='pad',pos=dict(x=0,y=0))])]
        self.assertEqual(discover.rank_pairs(nodes,set(),errors,8),[])
if __name__=='__main__':unittest.main()
