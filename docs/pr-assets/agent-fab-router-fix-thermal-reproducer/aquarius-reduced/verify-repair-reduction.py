#!/usr/bin/python3
"""Independently bind reduced witness outcomes to native reports and terminal groups."""
import argparse
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path
import native

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('terminals', HERE/'terminal-partitions.py')
terminals = importlib.util.module_from_spec(spec)
spec.loader.exec_module(terminals)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('results', type=Path)
    a = p.parse_args()
    s = json.loads((a.results/'summary.json').read_text())
    assert native.pcbnew.Version() == s['native_version'] == '10.0.6'
    assert s['script_sha256'] == hashlib.sha256((HERE/'reduce-repair.py').read_bytes()).hexdigest()
    assert len([r for r in s['rows'] if r['name'].startswith('final-')]) == 3
    finals = []
    for trial in s['rows']:
        before, after = trial['rows']
        for row in (before, after):
            folder = a.results/row['name']
            for name, digest in row['sha256'].items():
                path = folder/name
                raw = path.read_bytes() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes())
                assert hashlib.sha256(raw).hexdigest() == digest
            path = folder/'board.kicad_pcb'
            if path.exists():
                board = native.pcbnew.LoadBoard(str(path))
            else:
                # Keep filesystem loading semantics without overwriting retained evidence.
                with tempfile.TemporaryDirectory() as tmp:
                    local = Path(tmp)/'board.kicad_pcb'
                    local.write_bytes(gzip.decompress(Path(str(path)+'.gz').read_bytes()))
                    board = native.pcbnew.LoadBoard(str(local))
            groups = terminals.partition(board)
            assert groups == row['groups']
            report = json.loads((folder/'drc.json').read_text())
            errors = [v for v in report['violations'] if v['severity'] == 'error']
            target = [v for v in report['violations'] if v['type'] == 'starved_thermal'
                      and any(i['uuid'] == s['pad_uuid'] for i in v['items'])]
            assert errors == row['errors'] and target == row['target']
            assert len(report['unconnected_items']) == row['opens']
            assert row['counts'] == {key: len(list(getter())) for key, getter in (
                ('footprint', board.GetFootprints), ('zone', board.Zones))} | {
                'segment': sum(type(t) == native.pcbnew.PCB_TRACK for t in board.GetTracks()),
                'via': sum(type(t) == native.pcbnew.PCB_VIA for t in board.GetTracks())}
        accepted = (len(before['target']) == len(before['errors']) == 1 and not after['errors']
                    and not after['target'] and before['opens'] == after['opens']
                    and before['groups'] == after['groups'] == s['reference_groups'])
        assert accepted == trial['accepted']
        if trial['name'].startswith('final-'):
            assert accepted
            finals.append(trial)
            # Verify the sole changed track and two endpoint links from native geometry.
            def tracks(row):
                path = a.results/row['name']/'board.kicad_pcb'
                raw = path.read_text() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes()).decode()
                return {native.uid(n): n for n in native.parse(raw) if isinstance(n, list) and n[0] in ('segment', 'via')}
            old, new = tracks(before), tracks(after)
            assert set(old) <= set(new) and len(new) == len(old)+2
            assert all(old[uid] == new[uid] for uid in old if uid != s['track_uuid'])
            original, moved = old[s['track_uuid']], new[s['track_uuid']]
            endpoints = []
            for key in ('start', 'end'):
                start = [round(float(v)*1e6) for v in native.child(original, key)[1:]]
                end = [round(float(v)*1e6) for v in native.child(moved, key)[1:]]
                assert [b-a for a,b in zip(start,end)] == s['delta_nm']
                endpoints.append((start,end))
            links = [new[uid] for uid in set(new)-set(old)]
            for start, end in endpoints:
                assert any([round(float(v)*1e6) for v in native.child(link,'start')[1:]] == start
                    and [round(float(v)*1e6) for v in native.child(link,'end')[1:]] == end for link in links)
    multiset = lambda row: Counter(json.dumps(e,sort_keys=True) for e in row['errors'])
    for index in (0,1):
        assert all(multiset(r['rows'][index]) == multiset(finals[0]['rows'][index])
                   and r['rows'][index]['opens'] == finals[0]['rows'][index]['opens'] for r in finals)
    print(json.dumps(dict(verified_native_checks=2*len(s['rows']), final_repeats=3,
        terminals=len(s['reference_groups']), terminal_controls=[terminals.control() for _ in range(3)])))


if __name__ == '__main__':
    main()
