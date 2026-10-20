"""Create private opt-in config; execute the unchanged benchmark against one source checkout."""
import argparse,json,pathlib,subprocess,sys
p=argparse.ArgumentParser();p.add_argument('--integration',type=pathlib.Path,required=True);p.add_argument('--engine',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
integration=a.integration.resolve();engine=a.engine.resolve();out=a.out.resolve();out.mkdir()
config=out/'configs';config.mkdir();bench=integration/'benchmarks/autorouter';data=json.loads((bench/'configs/fab-router.json').read_text())
for job in data['jobs'].values():
 job['post_steps'].append([subprocess.check_output(['which','bun'],text=True).strip(),str(integration/'packages/router/bench/native-thermal-postprocess.ts'),'{input_dir}/board.kicad_pcb','{output_pcb}',str(engine),'{work_dir}/native-thermal-postprocess'])
(config/'fab-router.json').write_text(json.dumps(data,indent=2)+'\n')
cmd=['python3','benchmarks/autorouter/benchmark.py','--router','fab-router','--fab-router-source',str(engine),'--config-dir',str(config),'--out',str(out/'results')]
print(' '.join(cmd),flush=True);sys.exit(subprocess.run(cmd,cwd=integration).returncode)
