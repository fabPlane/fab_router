"""Render disjoint geometry/lattice owners; line numbers refer to captured source."""
import json
from pathlib import Path
from xml.sax.saxutils import escape

root = Path(__file__).resolve().parent
summary = json.loads((root / "summary.json").read_text())
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="910"><rect width="1200" height="910" fill="white"/><g font-family="sans-serif" fill="#182936"><text x="30" y="42" font-size="25">Largest disjoint geometry and lattice owners in retained profiles</text><text x="30" y="75" font-size="17">Percent of entire sampled profile; no new routes or measured speed improvement</text>']
for i, (case, result) in enumerate(summary.items()):
    y = 120 + i * 240
    svg.append(f'<text x="30" y="{y}" font-size="19">{escape(case.removesuffix("-profiled.cpuprofile.gz"))}</text>')
    entries = [(sum(weights.values()), label, weights) for group in ("geometry and clearance", "lattice") for label, weights in result["owner_us"][group].items()]
    for rank, (total, label, weights) in enumerate(sorted(entries, key=lambda e: (-e[0], e[1]))[:4]):
        row = y + 25 + rank * 46
        svg.append(f'<text x="30" y="{row+19}" font-size="16">{escape(label)}</text>')
        x = 490
        for mode, color in (("self_us", "#267b99"), ("descendant_us", "#dab53e")):
            width = weights[mode] / result["sampled_us"] * 2500
            svg.append(f'<rect x="{x:.4f}" y="{row}" width="{width:.4f}" height="28" fill="{color}"/>')
            x += width
        svg.append(f'<text x="{x+8:.4f}" y="{row+19}" font-size="16">{total/result["sampled_us"]*100:.2f}%</text>')
svg.append('<rect x="30" y="852" width="22" height="22" fill="#267b99"/><text x="65" y="870" font-size="18">Sample on owner frame</text><rect x="430" y="852" width="22" height="22" fill="#dab53e"/><text x="465" y="870" font-size="18">Sample in unrecognized descendant</text></g></svg>\n')
(root / "owners.svg").write_text("".join(svg))
