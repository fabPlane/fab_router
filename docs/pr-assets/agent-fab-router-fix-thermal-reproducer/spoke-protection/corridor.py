"""Full-area rectangular corridor evidence using native integer polygon booleans.

Only positive-area coverage of the requested rectangle is tested. This does not
count native spokes, resolve effective rules, prove plane connectivity, or handle
arbitrary pad geometry. Zero-area boundary differences are not measured.
"""
import pcbnew


def rectangle(left, top, right, bottom):
    if left >= right or top >= bottom:
        raise ValueError('corridor must have positive width and length')
    result = pcbnew.SHAPE_POLY_SET()
    result.NewOutline()
    for x, y in ((left, top), (right, top), (right, bottom), (left, bottom)):
        result.Append(x, y)
    return result


def coverage(copper, left, top, right, bottom):
    missing = rectangle(left, top, right, bottom)
    requested_area = missing.Area()
    missing.BooleanSubtract(copper)
    area = missing.Area()
    return dict(requested_area_nm2=requested_area, missing_area_nm2=area,
                positive_area_covered=area == 0)
