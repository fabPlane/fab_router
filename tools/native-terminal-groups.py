#!/usr/bin/env python3
"""Read pad connectivity from disposable boards already refilled by native DRC.

No filling or saving occurs here. Physical pad identities tolerate regenerated UUIDs;
ambiguous identities and non-equivalence native queries fail closed.
"""
import json
import sys
import pcbnew


def terminal_groups(path):
    board = pcbnew.LoadBoard(path)
    if board is None:
        raise ValueError('Cannot load native connectivity board')
    connectivity = board.GetConnectivity()
    if not connectivity.Build(board):
        raise ValueError('Cannot build native connectivity')
    pads = {}
    identities = set()
    for pad in board.GetPads():
        if pad.GetNetCode() <= 0:
            continue
        footprint = pad.GetParentFootprint()
        # Geometry/ownership are independently protected by the source-pad gate.
        # The native saved board may regenerate UUIDs, so do not use them as
        # cross-board terminal identities. Keep UUIDs only for this native query.
        identity = json.dumps([pad.GetNetname(), footprint.GetReference(),
            footprint.GetPosition().x, footprint.GetPosition().y,
            pad.GetNumber(), pad.GetPosition().x, pad.GetPosition().y,
            list(pad.GetLayerSet().Seq())], separators=(',', ':'))
        uuid = pad.m_Uuid.AsString()
        if identity in identities or uuid in pads:
            raise ValueError('Ambiguous native terminal identity')
        identities.add(identity)
        pads[uuid] = (pad, identity)
    groups = {}
    for uuid, (pad, identity) in pads.items():
        members = {identity}
        for item in connectivity.GetConnectedItems(pad):
            if item.GetClass() == 'PAD':
                other = pads.get(item.m_Uuid.AsString())
                if other is None or other[0].GetNetname() != pad.GetNetname():
                    raise ValueError('Invalid native terminal membership')
                members.add(other[1])
        groups[identity] = sorted(members)
    for members in groups.values():
        if any(groups[member] != members for member in members):
            raise ValueError('Native terminal groups are not an equivalence relation')
    return sorted({tuple(members) for members in groups.values()})


if __name__ == '__main__':
    before, after, output = sys.argv[1:]
    result = dict(nativeVersion=pcbnew.Version(), input=terminal_groups(before),
                  candidate=terminal_groups(after))
    with open(output, 'x') as stream:
        json.dump(result, stream)
        stream.write('\n')
