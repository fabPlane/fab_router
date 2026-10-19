from pathlib import Path
import subprocess,json,sys
root=Path(__file__).resolve().parents[4]; work=Path(sys.argv[1]).resolve()
records=[]
for repeat in range(1,4):
    for mode in (('original','candidate') if repeat%2 else ('candidate','original')):
        out=work/f'{mode}-{repeat}'
        cmd=['taskset','-c','12-19','nice','-n','10','timeout','240','bun',str(root/'docs/pr-assets/agent-fab-router-perf-local-rescue/point-components/profile.ts'),str(work/mode),str(work/'input'),str(out)]
        with (work/f'{mode}-{repeat}.log').open('w') as log:
            p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT)
        assert p.returncode==0,(mode,repeat,p.returncode)
        record={'mode':mode,'repeat':repeat,'result':json.loads((out/'result.json').read_text()),'ses':(out/'board.ses').read_text()}
        records.append(record);(work/'records.json').write_text(json.dumps(records,indent=2)+'\n')
        print(mode,repeat,record['result']['seconds'],flush=True)
