#!/usr/bin/python3
"""Independently bind each whole-board deletion to native design, errors and connectivity."""
import argparse
from collections import Counter
import json
from pathlib import Path
import ablate as m
import vias


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--results', type=Path, required=True)
    p.add_argument('--vias', action='store_true')
    x = p.parse_args()
    root = x.results
    z = json.loads((root/'summary.json').read_text())
    assert z['production_fix'] is False and z['routing_benchmark'] is False and z['native_version'] == '10.0.6'
    def source(role, ext='.kicad_pcb'):
        digests = [v for k,v in z['source_sha256'].items() if role in k and k.endswith(ext)]
        assert len(digests) == 1
        return (root/'sources'/digests[0]).read_bytes()
    for digest in z['source_sha256'].values():
        assert m.sha((root/'sources'/digest).read_bytes()) == digest
    data, input_data = source('/source/'), source('/input/')
    # Verify original-source identity too; this is a complete board, not the reduced fixture.
    assert m.sha(data) == '6f18a34265a5c610dfb12fbaa3c7757a7c9296c18bfde4d02878f16965fd3acc'
    nodes = m.native.parse(data.decode())
    def signature(ns):
        return Counter(m.native.dump(n) if isinstance(n,list) else n for n in ns)
    original_signature = signature(nodes)
    checks = opens = errors = 0
    def evidence(name, proposal, row):
        nonlocal checks, opens, errors
        board = root/name/'board.kicad_pcb'
        assert m.transaction.identity.design_signature(board.read_bytes()) == m.transaction.identity.design_signature(proposal)
        report = json.loads((board.parent/'drc.json').read_text())
        assert row['errors'] == [e for e in report['violations'] if e['severity'] == 'error']
        assert row['opens'] == len(report['unconnected_items'])
        assert row['groups'] == m.transaction.terminals.partition(m.native.pcbnew.LoadBoard(str(board)))
        ns = m.native.parse(proposal.decode())
        assert row['counts'] == {k:sum(isinstance(n,list) and n[0]==k for n in ns)
                                for k in ('footprint','segment','via','zone')}
        for ext in ('.kicad_pro','.kicad_dru'):
            assert board.with_suffix(ext).read_bytes() == source('/source/',ext) == source('/input/',ext)
        checks += 1; opens += row['opens']; errors += len(row['errors'])
    for r in z['rows']:
        baseline = r['baseline']
        evidence(f'baseline-{r["repeat"]}', data, baseline)
        assert len(baseline['errors']) == 6 and baseline['opens'] == 15
        pending = ([(uid,proposal,None) for uid,proposal in vias.candidates(data,input_data,baseline['errors'])]
                   if x.vias else list(m.candidates(data, input_data, baseline['errors'])))
        assert len(pending) == len(r['attempts'])
        for a,(uid,proposal,markers) in zip(r['attempts'],pending):
            assert (x.vias or r['markers'] == markers)
            assert a['via' if x.vias else 'track'] == uid and a['proposal_sha256'] == m.sha(proposal)
            # Every single original node remains exact except the one declared generated segment.
            deleted = next(n for n in nodes if isinstance(n,list) and n[0]==('via' if x.vias else 'segment') and m.native.uid(n)==uid)
            assert signature(m.native.parse(proposal.decode())) == original_signature-Counter([m.native.dump(deleted)])
            evidence(a['name'], proposal, a['row'])
            assert a['removed_errors'] == list((m.transaction.errors(baseline)-m.transaction.errors(a['row'])).elements())
            assert a['added_errors'] == list((m.transaction.errors(a['row'])-m.transaction.errors(baseline)).elements())
            assert a['lost_pairs'] == m.transaction.terminals.lost_pairs(baseline['groups'],a['row']['groups'])
    findings = [json.dumps([(a['via' if x.vias else 'track'],a['row']['errors'],a['row']['opens'],a['row']['groups'])
                           for a in r['attempts']], sort_keys=True) for r in z['rows']]
    assert len(findings) == 3 and len(set(findings)) == 1
    print(f'PASS: {checks} native checks; {errors} aggregate errors; {opens} aggregate opens')
    print('PASS: complete source, regenerated one-item deletions, exact other nodes, saved designs/rules, native reports and terminal partitions')

if __name__ == '__main__':
    main()
