from pathlib import Path
import sys
w=Path(sys.argv[1]);p=w/'candidate/src/lattice/prepared-core.ts'
p.write_bytes((Path(__file__).resolve().parent/'prepared-core.ts').read_bytes())
p=w/'candidate/src/lattice/grid.ts';s=p.read_text();a='    entry.cache.set(ck, shapes);';assert s.count(a)==1
p.write_text('import { prepareShape } from "./prepared-core.ts";\n'+s.replace(a,'    for (const shape of shapes) prepareShape(shape);\n'+a))
p=w/'candidate/src/route/clear.ts';s=p.read_text()
a='  const ca = coreOf(a), cb = coreOf(b);\n  const need = required + ca.r + cb.r;\n  const d2 = dist2Pts(ca.pts, cb.pts);\n  return orTouching ? d2 <= need * need : d2 < need * need;'
assert s.count(a)==1
p.write_text('import { closerPreparedConvex } from "../lattice/prepared-core.ts";\n'+s.replace(a,'  return closerPreparedConvex(a,b,required,orTouching);'))
