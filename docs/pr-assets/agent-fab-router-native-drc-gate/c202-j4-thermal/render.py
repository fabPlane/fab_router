"""Render the actual refilled front-copper exports at the affected U2.15 pad."""
import pathlib,xml.etree.ElementTree as E,subprocess,gzip
r=pathlib.Path(__file__).resolve().parent
ns='http://www.w3.org/2000/svg';E.register_namespace('',ns)
root=E.Element('{'+ns+'}svg',{'width':'1600','height':'800','viewBox':'0 0 1600 800'})
def add(parent,tag,attrs,text=None):
 n=E.SubElement(parent,'{'+ns+'}'+tag,attrs);n.text=text;return n
add(root,'rect',{'width':'1600','height':'800','fill':'#101923'})
add(root,'text',{'x':'40','y':'46','font-size':'30','font-family':'sans-serif','fill':'white'},'J4: native thermal repair around U2.15')
for index,phase in enumerate(['before','after']):
 x=40+index*790
 add(root,'text',{'x':str(x),'y':'94','font-size':'23','font-family':'sans-serif','fill':'white'},('Before: 1 introduced thermal error' if index==0 else 'After: 0 introduced errors'))
 panel=add(root,'svg',{'x':str(x),'y':'120','width':'730','height':'570','viewBox':'72.6 108.0 9 7','preserveAspectRatio':'xMidYMid meet'})
 path=r/(phase+'.svg'); raw=E.fromstring(path.read_bytes() if path.exists() else gzip.decompress((r/(phase+'.svg.gz')).read_bytes()))
 for node in raw:
  if node.tag.endswith('g'):panel.append(node)
 add(panel,'circle',{'cx':'76.073','cy':'111.125','r':'0.68','stroke':'#ffe66d','stroke-width':'.055','fill':'none','stroke-dasharray':'.12 .08'})
 add(root,'text',{'x':str(x),'y':'730','font-size':'21','font-family':'sans-serif','fill':'#ffe66d'},'Dashed marker: ground pad U2.15')
add(root,'text',{'x':'40','y':'778','font-size':'21','font-family':'sans-serif','fill':'#ced6e0'},'Same complete routed board, offline search: 3 repeats; zero opens and zero lost terminal pairs. Scored router unchanged.')
E.ElementTree(root).write(r/'comparison.svg',encoding='utf-8',xml_declaration=True)
subprocess.run(['rsvg-convert','-w','1600',str(r/'comparison.svg'),'-o',str(r/'comparison.png')],check=True)
