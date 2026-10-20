from pathlib import Path
import sys
p=Path(sys.argv[1])/'candidate/src/geom/predicates.ts'
s=p.read_text();old='    const area = cross(a, b, p);'
assert s.count(old)==1
s=s.replace(old,'    // Strictly left edges can neither contain p nor cross its +x ray.\n    if (p.x > a.x && p.x > b.x) continue;\n    const area = cross(a, b, p);')
p.write_text(s)
