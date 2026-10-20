from pathlib import Path
import sys
p=Path(sys.argv[1])/'candidate/src/lattice/grid.ts'
s=p.read_text()
a='      for (let cx = cx0; cx <= cx1; cx++) {\n        for (let cy = cy0; cy <= cy1; cy++) {\n          const list = g.cells.get(keyOf(cx, cy));'
b='      for (let cx = cx0; cx <= cx1; cx++) {\n        const rowKey = (cx + KEY_OFFSET) * KEY_STRIDE;\n        for (let cy = cy0; cy <= cy1; cy++) {\n          const list = g.cells.get(rowKey + (cy + KEY_OFFSET));'
assert s.count(a)==1
p.write_text(s.replace(a,b))
