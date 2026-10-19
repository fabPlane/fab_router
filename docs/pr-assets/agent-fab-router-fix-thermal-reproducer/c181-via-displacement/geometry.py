"""Offline connected-via displacement diagnostic; never edits an input tree."""
import copy

def child(node, key):
    return next((v for v in node if isinstance(v, list) and v[0] == key), None)

def relocate(nodes, uid, dx, dy, *, protected_ids):
    result = copy.deepcopy(nodes)
    via = next(n for n in result if isinstance(n, list) and n[0] == 'via'
               and child(n, 'uuid')[1].strip('"') == uid)
    if uid in protected_ids:
        raise ValueError('cannot move protected copper')
    net = child(via, 'net')
    if net is None or len(net) != 2:
        raise ValueError('via must declare a net')
    position = child(via, 'at')
    old = tuple(map(float, position[1:3]))
    new = [format(old[0]+dx, '.8g'), format(old[1]+dy, '.8g')]
    position[1:3] = new
    for node in result:
        if not isinstance(node, list) or node[0] != 'segment': continue
        for key in ('start', 'end'):
            endpoint = child(node, key)
            if tuple(map(float, endpoint[1:3])) == old:
                track_net = child(node, 'net')
                if track_net is None or len(track_net) != 2:
                    raise ValueError('incident track must declare a net')
                if track_net != net:
                    continue
                if child(node, 'uuid')[1].strip('"') in protected_ids:
                    raise ValueError('cannot move protected copper')
                endpoint[1:3] = new
    return result
