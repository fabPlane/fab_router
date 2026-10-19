import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('complete',Path(__file__).with_name('complete.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def row(errors):return dict(errors=[dict(type=e) for e in errors],groups={'pad':['pad']},opens=0)
class Complete(unittest.TestCase):
    def test_refreshes_proposals_after_each_accepted_stage(self):
        calls=[]
        def proposals(data,baseline):
            calls.append((data,len(baseline['errors'])))
            yield 'trial',b'one' if data==b'original' else b'clean'
        out,clean,trace=m.repair(b'original',row(['a','b']),proposals,
            lambda data,name:row(['b'] if data==b'one' else []),3)
        self.assertEqual((out,clean),(b'clean',True))
        self.assertEqual(calls,[(b'original',2),(b'one',1)])
        self.assertEqual(len(trace),2)
    def test_exhaustion_restores_whole_source_after_partial_progress(self):
        def proposals(data,baseline):
            if data==b'original':yield 'trial',b'one'
        out,clean,trace=m.repair(b'original',row(['a','b']),proposals,
            lambda data,name:row(['b']),3)
        self.assertEqual((out,clean),(b'original',False))
    def test_stage_limit_does_not_publish_partial_progress(self):
        out,clean,_=m.repair(b'original',row(['a','b']),lambda *_:[('trial',b'one')],
            lambda *_:row(['b']),1)
        self.assertEqual((out,clean),(b'original',False))
    def test_checker_exception_does_not_publish_partial_progress(self):
        def check(data,name):
            if data==b'bad':raise TimeoutError('injected')
            return row(['b'])
        def proposals(data,baseline):yield 'trial',b'one' if data==b'original' else b'bad'
        out,clean,trace=m.repair(b'original',row(['a','b']),proposals,check,3)
        self.assertEqual((out,clean),(b'original',False))
        self.assertEqual(trace[-1]['attempts'][0]['exception'],'TimeoutError')
if __name__=='__main__':unittest.main()
