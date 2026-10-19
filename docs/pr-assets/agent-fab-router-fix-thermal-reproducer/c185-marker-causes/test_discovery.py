"""Candidate discovery uses marker pad identity and the declared copper stack."""
import unittest
from discovery import rank_vias

def via(uid, x, layers):
    return ['via', ['at', str(x), '0'], ['layers', *layers], ['uuid', uid]]

def error(layer, pad='pad'):
    return {'type':'starved_thermal','items':[{'uuid':pad,'pos':{'x':0,'y':0}}, {'uuid':layer,'pos':{'x':1000,'y':1000}}]}

def board():
    return [['layers',['0','F.Cu','signal'],['2','In1.Cu','signal'],['4','In2.Cu','signal'],['31','B.Cu','signal']],
            ['footprint',['pad','1',['uuid','pad']]],
            ['zone',['uuid','zone'],['layer','In1.Cu']]]

class Discovery(unittest.TestCase):
    def test_spanning_via_and_protected_exclusion(self):
        nodes=board()+[via('protected',0,['F.Cu','B.Cu']),via('through',2,['F.Cu','B.Cu']),via('blind',1,['F.Cu','In1.Cu']),via('wrong',0,['In2.Cu','B.Cu'])]
        self.assertEqual(rank_vias(nodes,{'protected'},error('zone'),8),['blind','through'])
    def test_pad_marker_not_zone_anchor_and_ties(self):
        nodes=board()+[via('b',1,['F.Cu','B.Cu']),via('a',-1,['F.Cu','B.Cu']),via('anchor',1000,['F.Cu','B.Cu'])]
        self.assertEqual(rank_vias(nodes,set(),error('zone'),2),['a','b'])
    def test_no_recognized_pad_or_thermal(self):
        nodes=board()+[via('a',0,['F.Cu','B.Cu'])]
        self.assertEqual(rank_vias(nodes,set(),error('zone','other'),8),[])
        e=error('zone');e['type']='clearance';self.assertEqual(rank_vias(nodes,set(),e,8),[])
    def test_invalid_limit(self):
        for limit in (0,9):
            with self.assertRaises(ValueError):rank_vias(board(),set(),error('zone'),limit)

if __name__=='__main__':unittest.main()
