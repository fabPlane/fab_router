#!/usr/bin/python3
"""Audit native terminal groups on already-refilled static dogleg boards."""
import argparse
import hashlib
import json
from pathlib import Path
import pcbnew


def uid(item):
    return item.m_Uuid.AsString()


def partition(board):
    connectivity = board.GetConnectivity()
    assert connectivity.Build(board)
    pads = {uid(p): p for p in board.GetPads() if p.GetNetCode() > 0}
    groups = {}
    for identity, pad in pads.items():
        members = {identity}
        members.update(uid(item) for item in connectivity.GetConnectedItems(pad)
                       if item.GetClass() == 'PAD' and uid(item) in pads)
        assert all(pads[member].GetNetname() == pad.GetNetname() for member in members)
        groups[identity] = sorted(members)
    # The native query must form an equivalence relation, not just adjacency.
    assert all(groups[member] == group for group in groups.values() for member in group)
    return groups


def lost_pairs(before, after):
    assert before.keys() == after.keys(), 'terminal inventory changed'
    return sorted([left, right] for left, members in before.items() for right in members
                  if left < right and right not in after[left])


def control():
    board = pcbnew.BOARD()
    net = pcbnew.NETINFO_ITEM(board, 'signal', 1)
    board.Add(net)
    for index in range(4):
        footprint = pcbnew.FOOTPRINT(board)
        board.Add(footprint)
        pad = pcbnew.PAD(footprint)
        pad.SetNumber(str(index))
        pad.SetSize(pcbnew.VECTOR2I(1000000, 1000000))
        pad.SetPosition(pcbnew.VECTOR2I(index * 10000000, 0))
        pad.SetAttribute(pcbnew.PAD_ATTRIB_SMD)
        layers = pcbnew.LSET()
        layers.AddLayer(pcbnew.F_Cu)
        pad.SetLayerSet(layers)
        pad.SetNet(net)
        footprint.Add(pad)
    tracks = []
    for start, end in [(0, 10), (10, 20)]:
        track = pcbnew.PCB_TRACK(board)
        track.SetStart(pcbnew.VECTOR2I(start * 1000000, 0))
        track.SetEnd(pcbnew.VECTOR2I(end * 1000000, 0))
        track.SetWidth(200000)
        track.SetLayer(pcbnew.F_Cu)
        track.SetNet(net)
        board.Add(track)
        tracks.append(track)
    before = partition(board)
    assert sorted(len(group) for group in before.values()) == [1, 3, 3, 3]
    assert not lost_pairs(before, partition(board))
    # Move the middle bridge: disconnect pad 0 while joining pad 3. The
    # component count and number of connected pairs remain identical.
    tracks[0].SetStart(pcbnew.VECTOR2I(20000000, 0))
    tracks[0].SetEnd(pcbnew.VECTOR2I(30000000, 0))
    after = partition(board)
    assert sorted(len(group) for group in after.values()) == [1, 3, 3, 3]
    losses = lost_pairs(before, after)
    assert len(losses) == 2
    return dict(equal_component_count=True, lost_terminal_pairs=len(losses),
                unchanged_accepted=True, rewired_rejected=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--boards', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    assert pcbnew.Version() == '10.0.6'
    args.out.mkdir(exist_ok=False, parents=True)
    controls = [control() for _ in range(3)]
    summary = json.loads((args.boards / 'summary.json').read_text())
    rows = []
    baseline = None
    for row in summary['rows']:
        directory = args.boards / row['name']
        # Bind every source file used by the prior native check before loading.
        for name, expected in row['sha256'].items():
            assert hashlib.sha256((directory / name).read_bytes()).hexdigest() == expected
        path = directory / 'board.kicad_pcb'
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        board = pcbnew.LoadBoard(str(path))
        groups = partition(board)
        if baseline is None:
            baseline = groups
        losses = lost_pairs(baseline, groups)
        result = dict(name=row['name'], board_sha256=digest, terminals=len(groups),
                      components=len({tuple(group) for group in groups.values()}),
                      lost_pairs=losses, exact_partition=groups == baseline,
                      partitions=sorted({tuple(group) for group in groups.values()}))
        rows.append(result)
        assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
        print(json.dumps({key: value for key, value in result.items() if key != 'partitions'}), flush=True)
    (args.out / 'summary.json').write_text(json.dumps(dict(native_version=pcbnew.Version(),
        controls=controls, rows=rows, production_fix=False, routing_benchmark=False), indent=2) + '\n')
    assert all(row['exact_partition'] for row in rows)


if __name__ == '__main__':
    main()
