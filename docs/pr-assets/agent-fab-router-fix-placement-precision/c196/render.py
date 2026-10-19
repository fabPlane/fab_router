from PIL import Image,ImageDraw,ImageFont
import json,pathlib,sys
root=pathlib.Path(sys.argv[1]);data=json.loads((root/'comparison.json').read_text())['summary'];im=Image.new('RGB',(1400,690),'white');d=ImageDraw.Draw(im);font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';f=ImageFont.truetype(font,27);title=ImageFont.truetype(font,36)
d.text((65,40),'Preserve authored placement during session export',font=title,fill='#162a43');d.text((65,100),'26 fixed tasks × 3 repeats · same host · native checks',font=f,fill='#455468')
for row,(label,key) in enumerate([('Outputs with moved footprints','runs_with_drift'),('Native passes','passed'),('Native opens','opens'),('New native DRC errors','new_errors')]):
 yy=190+row*105;d.text((65,yy),label,font=f,fill='#162a43')
 for xx,phase,color in [(710,'before','#b55240'),(1030,'after','#237b6a')]:d.text((xx,yy),str(data[phase][key]),font=title,fill=color)
d.text((710,140),'Before',font=f,fill='#b55240');d.text((1030,140),'After',font=f,fill='#237b6a');d.text((65,625),'Placement fidelity improves; thermal failures remain unresolved.',font=f,fill='#455468');im.save(root/'placement.png')
