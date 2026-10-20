# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import subprocess,sys,tarfile
p=Path(__file__).resolve().parent;w=Path(sys.argv[1]).resolve();root=p.parents[2]
subprocess.run([sys.executable,str(p/'prepare.py'),str(w)],check=True)
with tarfile.open(p/'targeted-tests.tar.xz')as t:t.extractall(w/'candidate',filter='data')
(w/'candidate/node_modules').symlink_to(root/'node_modules',target_is_directory=True)
subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','120','bun','run','typecheck'],cwd=w/'candidate',check=True)
subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','120','bun','test','test/geom-exact.test.ts','test/geom-shapes.test.ts','test/perf-invariance.test.ts'],cwd=w/'candidate',check=True)
