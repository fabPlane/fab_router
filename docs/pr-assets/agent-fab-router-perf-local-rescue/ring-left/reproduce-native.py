"""python3 reproduce-native.py BENCH_CHECKOUT NEW_OUT (private native runtime already installed)."""
from pathlib import Path
import subprocess,sys
p=Path(__file__).resolve().parent
bench,out=map(lambda s:Path(s).resolve(),sys.argv[1:]);out.mkdir(exist_ok=False)
subprocess.run([sys.executable,str(p/'reproduce.py'),str(out/'sources'),'--prepare-only'],check=True)
for mode in ['control','candidate']:
 source=out/'sources'/mode
 subprocess.run(['git','init','-b','agent/ring-left-replay',str(source)],check=True)
 subprocess.run(['git','-C',str(source),'add','src','spec','package.json','tsconfig.json'],check=True)
 subprocess.run(['git','-C',str(source),'-c','user.name=Benchmark Agent','-c','user.email=benchmark-agent@users.noreply.github.com','commit','-m','Reconstruct measured predicate source'],check=True,stdout=subprocess.DEVNULL)
 with (out/f'native-{mode}.log').open('w') as log:
  subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=10','1800','python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(source),'--out',str(out/f'native-{mode}')],cwd=bench,stdout=log,stderr=subprocess.STDOUT,check=True)
subprocess.run([sys.executable,str(p/'compare.py'),str(out/'native-control'),str(out/'native-candidate'),str(out/'comparison.json')],check=True)
