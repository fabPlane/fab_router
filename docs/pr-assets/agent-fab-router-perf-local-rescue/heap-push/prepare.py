from pathlib import Path
import sys
p=Path(sys.argv[1])/'candidate/src/route/search.ts'
s=p.read_text();start=s.index('    this.f[i] = f; this.h[i] = h; this.seq[i] = seq; this.st[i] = state;',s.index('class SoaHeap'))
end=s.index('\n  pop(): void',start)
s=s[:start]+'''    while (i > 0) {
      const p = (i - 1) >> 1;
      const pf = this.f[p]!, ph = this.h[p]!, ps = this.seq[p]!;
      if (!(f < pf || (f === pf && (h < ph || (h === ph && seq < ps))))) break;
      this.f[i] = pf; this.h[i] = ph; this.seq[i] = ps; this.st[i] = this.st[p]!;
      i = p;
    }
    this.f[i] = f; this.h[i] = h; this.seq[i] = seq; this.st[i] = state;
  }'''+s[end:]
p.write_text(s)
