from pathlib import Path
root=Path(__file__).resolve().parent
text=(root/'minimize.py').read_text().split('baseline,_=inspect')[0]
text=text.replace("OUT=ROOT/'minimized';OUT.mkdir(exist_ok=False)","OUT=ROOT/'recheck';OUT.mkdir(exist_ok=False)")
ns={'__file__':str(root/'minimize.py')};exec(compile(text,'native-recheck','exec'),ns)
ns['baseline'],_=ns['inspect']([], 'source-0');ns['before']={v:i for i,g in enumerate(ns['baseline']) for v in g}
for seed in range(3):
 if seed:ns['inspect']([],f'source-{seed}')
 ns['inspect'](list(range(len(ns['added']))),f'full-{seed}')
 ns['inspect'](__import__('json').loads((root/'minimized/summary.json').read_text())['indices'],f'reduced-{seed}')
