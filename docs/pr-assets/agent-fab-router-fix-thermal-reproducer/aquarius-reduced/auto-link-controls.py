#!/usr/bin/python3
"""Bounded metadata-driven search controls; native DRC is not mocked as evidence."""
import unittest
import transaction

helper = transaction.module('auto_links', 'auto-links.py')

def row(*pads):
    return dict(errors=[dict(type='starved_thermal', items=[dict(uuid=p)]) for p in pads],
                groups={p:[p] for p in ('a','b','c')}, opens=2)

class Search(unittest.TestCase):
    def test_targets_are_native_errors_intersected_with_terminals(self):
        baseline=row('b','a','b','zone')
        baseline['errors'].append(dict(type='clearance',items=[dict(uuid='c')]))
        self.assertEqual(helper.targets(baseline), ['a','b'])

    def test_refreshes_after_acceptance(self):
        checked=[]; generated=[]
        states={b'original':row('a','b'),b'repaired':row('b'),b'final':row()}
        def check(data,name):
            checked.append((data,name));return states[data]
        def proposals(data,baseline,target):
            generated.append((data,target))
            yield dict(kind='control'), b'repaired' if data==b'original' else b'final'
        output,report=helper.search(b'original',check,proposals,8)
        self.assertEqual(output,b'final')
        self.assertEqual(generated,[(b'original','a'),(b'repaired','b')])
        self.assertEqual(len(checked),3)
        self.assertEqual(report['stop'],'no-thermal-targets')

    def test_budget_counts_rejected_checks(self):
        checked=[]
        def check(data,name):checked.append(data);return row('a')
        def proposals(*args):
            for i in range(5):yield dict(index=i),str(i).encode()
        output,report=helper.search(b'original',check,proposals,2)
        self.assertEqual(output,b'original');self.assertEqual(len(checked),3)
        self.assertEqual(report['stop'],'budget');self.assertEqual(len(report['attempts']),2)

    def test_budget_does_not_generate_an_unchecked_candidate(self):
        generated=[]
        def proposals(*args):
            for i in range(5):
                generated.append(i)
                yield dict(index=i),str(i).encode()
        output,report=helper.search(b'original',lambda *args:row('a'),proposals,2)
        self.assertEqual(generated,[0,1])
        self.assertEqual(output,b'original')
        self.assertEqual(len(report['attempts']),2)
        self.assertEqual(report['stop'],'budget')

    def test_failure_beyond_budget_is_never_requested(self):
        def proposals(*args):
            yield {},b'rejected'
            raise RuntimeError('outside authorized search budget')
        output,report=helper.search(b'original',lambda *args:row('a'),proposals,1)
        self.assertEqual(output,b'original')
        self.assertEqual(len(report['attempts']),1)
        self.assertEqual(report['stop'],'budget')

    def test_checker_exception_rolls_back_then_continues(self):
        def check(data,name):
            if data==b'bad':raise TimeoutError('control')
            return row('a') if data==b'original' else row()
        def proposals(*args):
            yield {},b'bad';yield {},b'good'
        output,report=helper.search(b'original',check,proposals,2)
        self.assertEqual(output,b'good')
        self.assertEqual(report['attempts'][0]['exception'],'TimeoutError')

    def test_new_error_and_terminal_loss_reject(self):
        changed=row();del changed['groups']['a']
        new_error=row();new_error['errors']=[dict(type='clearance',items=[])]
        def check(data,name):return {b'original':row('a'),b'lost':changed,b'new':new_error}[data]
        def proposals(*args):yield {},b'lost';yield {},b'new'
        output,report=helper.search(b'original',check,proposals,8)
        self.assertEqual(output,b'original');self.assertEqual(report['stop'],'exhausted')

    def test_real_pair_loss_and_increased_opens_reject(self):
        baseline=row('a');baseline['groups']={'a':['a','b'],'b':['a','b']}
        lost=row();lost['groups']={'a':['a'],'b':['b']}
        opened=dict(baseline,errors=[],opens=3)
        def check(data,name):return {b'original':baseline,b'lost':lost,b'opened':opened}[data]
        def proposals(*args):yield {},b'lost';yield {},b'opened'
        output,report=helper.search(b'original',check,proposals,8)
        self.assertEqual(output,b'original');self.assertEqual(report['stop'],'exhausted')

    def test_unsupported_metadata_is_recorded(self):
        def proposals(*args):
            raise ValueError('ambiguous plane layers')
            yield
        output,report=helper.search(b'original',lambda *args:row('a'),proposals,8)
        self.assertEqual(output,b'original');self.assertEqual(report['stop'],'exhausted')
        self.assertEqual(report['skipped'][0]['reason'],'ambiguous plane layers')

    def test_discovered_targets_disappear_together(self):
        def check(data,name):return row('a','b') if data==b'original' else row()
        def proposals(*args):yield {},b'final'
        output,report=helper.search(b'original',check,proposals,8)
        self.assertEqual(output,b'final');self.assertEqual(len(report['attempts']),1)
        self.assertEqual(report['stop'],'no-thermal-targets')

    def test_unexpected_generation_failure_propagates(self):
        def proposals(*args):
            raise RuntimeError('generation failed')
            yield
        with self.assertRaisesRegex(RuntimeError,'generation failed'):
            helper.search(b'original',lambda *args:row('a'),proposals,8)

    def test_invalid_budget_fails_before_checker(self):
        for budget in (0,-1):
            with self.assertRaises(ValueError):helper.search(b'',None,None,budget)

if __name__=='__main__':unittest.main()
