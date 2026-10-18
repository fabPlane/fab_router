"""Render the copied-layout regression geometry in millimetres; stdlib + rsvg-convert."""
from pathlib import Path
import subprocess
out=Path(__file__).resolve().parent
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="690" viewBox="0 0 1300 690">', '<rect width="1300" height="690" fill="#101b2b"/>', '<g fill="#edf4ff" font-family="sans-serif">', '<text x="50" y="55" font-size="29">Session import: preserve the design file resolution</text>', '<text x="50" y="90" font-size="19">Same resolution-less session, copied Layout, 20 × 20 mm boundary</text>']
for left,label,color,pts,width in [(60,'Before: copper scaled 10×','#ff977b',[(10,10),(20,10)],2),(690,'After: file metadata restored','#72e4bd',[(1,1),(2,1)],.2)]:
 svg += [f'<text x="{left}" y="140" font-size="24">{label}</text>',f'<rect x="{left}" y="170" width="480" height="480" fill="#18283b" stroke="#6e8cac" stroke-width="2"/>']
 for tick in [0,5,10,15,20]:
  x=left+tick*24; y=650-tick*24
  svg += [f'<path d="M {x} 170 V 650 M {left} {y} h 480" stroke="#294057"/>',f'<text x="{x}" y="675" font-size="14">{tick}</text>']
 a,b=pts
 svg += [f'<path d="M {left+a[0]*24} {650-a[1]*24} L {left+b[0]*24} {650-b[1]*24}" stroke="{color}" stroke-width="{width*24}" stroke-linecap="round"/>',f'<text x="{left+20}" y="205" font-size="17">({a[0]}, {a[1]}) → ({b[0]}, {b[1]}) mm; width {width} mm</text>']
svg += ['</g></svg>']
p=out/'session-units.svg';p.write_text('\n'.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(p),'-o',str(out/'session-units.png')],check=True)
