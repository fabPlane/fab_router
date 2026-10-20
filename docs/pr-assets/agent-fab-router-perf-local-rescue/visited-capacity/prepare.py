from pathlib import Path
import sys
p=Path(sys.argv[1])/'candidate/src/route/search.ts';s=p.read_text();a=s.index('class VisitedStore');b=s.index('  reset(): void',a);t=s[a:b].replace('(1024)','(4096)').replace('= 1023','= 4095').replace('= 1024','= 4096');assert s[a:b]!=t;p.write_text(s[:a]+t+s[b:])
