from pathlib import Path
import sys
p=Path(sys.argv[1])/'candidate/src/route/search.ts'
s=p.read_text()
needle='  /** Parent state of `key`, or `NONE` when `key` is a start or absent. */'
method='  /** Compare and store a winning relaxation with one table probe. */\n  relax(key: number, g: number, parent: number): boolean {\n    this.probe(key);\n    let i = this.pi;\n    if (this.pf) {\n      if (this.gval[i]! <= g) return false;\n    } else {\n      if ((this.count + 1) * 10 > this.cap * 7) { this.grow(); let j = this.hash(key); while (this.stamp[j] === this.gen) j = (j + 1) & this.mask; i = j; }\n      this.keys[i] = key; this.stamp[i] = this.gen; this.count++;\n    }\n    this.gval[i] = g; this.parent[i] = parent;\n    return true;\n  }\n'
assert s.count(needle)==1
s=s.replace(needle,method+needle)
old='      if (VIS.leq(nState, stepG)) continue;\n      VIS.put(nState, stepG, nodeState);'
assert s.count(old)==3
s=s.replace(old,'      if (!VIS.relax(nState, stepG, nodeState)) continue;')
p.write_text(s)
