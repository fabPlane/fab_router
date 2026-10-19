"""Bind diagnostic metadata to board/project/custom-rule bytes and native version.

This detects stale inputs between observations. It cannot provide atomic native
transactions, resolve effective thermal settings, or establish routing safety.
Absent sidecars are recorded explicitly; absence does not mean safe defaults.
Only the same-stem native project and rule sidecars are covered.
"""
import hashlib
import pathlib


def capture(board, native_version):
    board = pathlib.Path(board)
    result = {'schema': 1, 'native_version': native_version}
    for label, suffix in (('board', '.kicad_pcb'), ('project', '.kicad_pro'),
                          ('rules', '.kicad_dru')):
        path = board.with_suffix(suffix)
        # The board is mandatory. Missing sidecars are distinct from empty files.
        result[label] = (hashlib.sha256(path.read_bytes()).hexdigest()
                         if label == 'board' or path.exists() else None)
    return result


def validate(manifest, board, native_version):
    current = capture(board, native_version)
    if manifest != current:
        changed = sorted(key for key in set(manifest) | set(current)
                         if manifest.get(key) != current.get(key))
        raise ValueError('Diagnostic input identity changed: ' + ', '.join(changed))
