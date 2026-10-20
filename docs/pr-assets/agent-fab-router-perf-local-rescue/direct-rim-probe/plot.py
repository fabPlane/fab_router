from pathlib import Path
import gzip, json, subprocess

a = Path(__file__).resolve().parent
s = json.loads((a / 'summary.json').read_text())
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="850" viewBox="0 0 1600 850">',
       '<rect width="1600" height="850" fill="#fafafa"/>',
       '<g font-family="sans-serif" fill="#202020">',
       '<text x="70" y="65" font-size="34">Direct rounded rim probes: focused experiment</text>',
       '<text x="70" y="105" font-size="22">Three alternating pairs per input; all session hashes and non-timing reports match.</text>']
for panel, (key, title) in enumerate([('records', 'L2 fixed two passes'), ('aquarius-records', 'Aquarius engine replay')]):
    left = 90 + 780 * panel
    data = s[key]
    maximum = max(data[m]['p95_max3_s'] for m in ['original', 'candidate']) * 1.12
    base, height = 620, 370
    delta = (data['candidate']['median_s'] / data['original']['median_s'] - 1) * 100
    svg += [f'<text x="{left}" y="180" font-size="27">{title}</text>',
            f'<text x="{left}" y="217" font-size="22">Median change: {delta:+.2f}%</text>']
    for i in range(3):
        for j, mode in enumerate(['original', 'candidate']):
            seconds = data[mode]['seconds'][i]
            x = left + 20 + i * 205 + j * 79
            h = seconds / maximum * height
            color = '#586e85' if j == 0 else '#c56228'
            svg += [f'<rect x="{x}" y="{base-h}" width="66" height="{h}" fill="{color}"/>',
                    f'<text x="{x+33}" y="{base-h-12}" text-anchor="middle" font-size="18">{seconds:.2f}</text>']
        svg.append(f'<text x="{left+90+i*205}" y="655" text-anchor="middle" font-size="20">Pair {i+1}</text>')
    svg += [f'<text x="{left}" y="704" font-size="20">Control median / max: {data["original"]["median_s"]:.3f} / {data["original"]["p95_max3_s"]:.3f} s</text>',
            f'<text x="{left}" y="736" font-size="20">Candidate median / max: {data["candidate"]["median_s"]:.3f} / {data["candidate"]["p95_max3_s"]:.3f} s</text>']
svg += ['<text x="70" y="800" font-size="21">Gray: control. Orange: candidate. Shared-host observations; engine replays only; native comparison reported separately.</text>', '</g></svg>']
(a / 'timings.svg').write_text('\n'.join(svg) + '\n')
subprocess.run(['rsvg-convert', '-w', '1600', a / 'timings.svg', '-o', a / 'timings.png'], check=True)
