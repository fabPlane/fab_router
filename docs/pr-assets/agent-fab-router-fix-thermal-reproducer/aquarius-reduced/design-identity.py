"""Design identity shared by live native diagnostics and retained evidence audits."""
from collections import Counter
from decimal import Decimal, InvalidOperation
import native


def design_signature(data):
    """Compare all design nodes; allow native refill and top-level item sorting.

    Only zone filled polygons are derived output. Keep zone rules/outlines,
    footprints, pad metadata, every copper item and all other board settings.
    Decimal values allow the native writer to normalize numeric formatting.
    """
    def normalize(node):
        if isinstance(node, list):
            children = node
            if node and node[0] == 'zone':
                children = [x for x in node if not (
                    isinstance(x, list) and x[0] == 'filled_polygon')]
            return tuple(normalize(x) for x in children)
        try:
            return Decimal(node)
        except InvalidOperation:
            return node
    tree = native.parse(data.decode())
    assert tree[0] == 'kicad_pcb'
    return Counter(normalize(node) for node in tree[1:])
