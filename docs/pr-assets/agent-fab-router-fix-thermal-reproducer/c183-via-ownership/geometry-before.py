"""Offline connected-via displacement diagnostic; never edits an input tree."""
import copy

def child(node, key):
    return next((v for v in node if isinstance(v, list) and v[0] == key), None)

def relocate(nodes, uid, dx, dy):
    result = copy.deepcopy(nodes)
    via = next(n for n in result if isinstance(n, list) and n[0] == 'via'
               and child(n, 'uuid')[1].strip('"') == uid)
    position = child(via, 'at')
    old = tuple(map(float, position[1:3]))
    new = [format(old[0]+dx, '.8g'), format(old[1]+dy, '.8g')]
    position[1:3] = new
    for node in result:
        if not isinstance(node, list) or node[0] != 'segment': continue
        for key in ('start', 'end'):
            endpoint = child(node, key)
            if tuple(map(float, endpoint[1:3])) == old:
                endpoint[1:3] = new
    return result
