import pcbnew,json,pathlib,subprocess,re,hashlib,argparse
p=argparse.ArgumentParser();p.add_argument('repo',type=pathlib.Path);p.add_argument('out',type=pathlib.Path);p.add_argument('--fixed',action='store_true');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
rows=[]
for label,x,y in [('subgrid',70405952,26615000),('grid',70406000,26615000),('two_axes',168657392,44931946)]:
 d=a.out/label;d.mkdir(exist_ok=True);b=pcbnew.BOARD();f=pcbnew.FOOTPRINT(b);f.SetReference('U1');f.SetFPID(pcbnew.LIB_ID('Probe','OnePad'));b.Add(f);f.SetPosition(pcbnew.VECTOR2I(x,y));pad=pcbnew.PAD(f);pad.SetNumber('1');pad.SetAttribute(pcbnew.PAD_ATTRIB_SMD);pad.SetShape(pcbnew.PAD_SHAPE_RECT);pad.SetSize(pcbnew.VECTOR2I(1000000,1000000));pad.SetLayerSet(pcbnew.LSET.AllCuMask());f.Add(pad);pad.SetPosition(f.GetPosition());pcbnew.SaveBoard(str(d/'input.kicad_pcb'),b)
 assert pcbnew.ExportSpecctraDSN(b,str(d/'input.dsn'))
 script='''import {readDsn,writeSes} from REPO; const r=readDsn(await Bun.file(process.argv[2]!).text(),{name:"input.dsn"});if(!r.ok)throw Error("read failed"); await Bun.write(process.argv[3]!,writeSes(r.layout));console.log(JSON.stringify({frame:r.layout.frame,part:r.layout.parts[0]}));'''.replace('REPO',json.dumps(str(a.repo/'src/api.ts')))
 (d/'write.ts').write_text(script);r=subprocess.run(['bun',str(d/'write.ts'),str(d/'input.dsn'),str(d/'writer.ses')],capture_output=True,text=True,timeout=60,check=True);(d/'layout.json').write_text(r.stdout)
 ses=(d/'writer.ses').read_text();start=ses.index('(placement');depth=0
 for end in range(start,len(ses)):
  if ses[end]=='(':depth+=1
  elif ses[end]==')':
   depth-=1
   if depth==0:break
 (d/'without-placement.ses').write_text(ses[:start]+'(placement (resolution um 10))'+ses[end+1:])
 # Native unchanged save controls distinguish save formatting from import movement.
 for repeat in range(1,4):
  for mode in ['save-only','writer','without-placement']:
   board=pcbnew.LoadBoard(str(d/'input.kicad_pcb'))
   if mode!='save-only':assert pcbnew.ImportSpecctraSES(board,str(d/(mode+'.ses')))
   path=d/f'{mode}-{repeat}.kicad_pcb';pcbnew.SaveBoard(str(path),board);saved=pcbnew.LoadBoard(str(path));fp=list(saved.GetFootprints())[0];pos=fp.GetPosition();pp=list(fp.Pads())[0].GetPosition();row=dict(case=label,repeat=repeat,mode=mode,input_nm=[x,y],footprint_nm=[pos.x,pos.y],pad_nm=[pp.x,pp.y]);row['changed']=row['input_nm']!=row['footprint_nm'];rows.append(row)
(a.out/'results.json').write_text(json.dumps(rows,indent=2));assert len(rows)==27
for row in rows:assert row['changed']==(not a.fixed and row['case']!='grid' and row['mode']=='writer'),row
print(json.dumps(dict(native_version=pcbnew.Version(),checks=len(rows),changed=sum(r['changed'] for r in rows),result='PASS'),indent=2))
