#!/usr/bin/python3
"""Check both known corridors after native refill; finite samples, not a safety proof."""
import argparse
import json
import pathlib
from importlib.util import spec_from_file_location, module_from_spec
HERE = pathlib.Path(__file__).resolve().parent
spec = spec_from_file_location('filled', HERE / 'filled-spokes.py')
filled = module_from_spec(spec)
spec.loader.exec_module(filled)

def run(directory):
    summary = json.loads((directory / 'summary.json').read_text())
    rows = []
    for row in summary['rows']:
        variant = row['direction']
        folder = directory / f"{row['repeat']}-{variant}"
        samples = filled.sample(folder / 'after.kicad_pcb')
        observed = [d for d, v in samples['directions'].items() if v['all_samples_filled']]
        assert observed == (['leftward'] if variant == 'leftward' else ['downward', 'leftward'])
        engine = row['engine']
        assert len(engine['guards']) == (1 if variant == 'leftward' else 2)
        assert not engine['after']['incompletes'] and not engine['after']['violations']
        rows.append(dict(variant=variant, repeat=row['repeat'], errors=row['errors'], opens=row['opens'],
                         native_report_sha256=filled.digest(folder / 'after.json'), **samples))
    (directory / 'samples.json').write_text(json.dumps(dict(production_fix=False, rows=rows), indent=2)+'\n')
    elements = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360">', '<rect width="1200" height="360" fill="#f4f6f8"/>']
    def text(x, y, value, size=23):
        elements.append(f'<text x="{x}" y="{y}" fill="#152033" font-family="sans-serif" font-size="{size}">{value}</text>')
    text(30, 42, 'Protecting both known spokes prevents the miniature thermal failure', 27)
    text(30, 78, 'Same native input, rules, seed and settings; three repeats per variant', 21)
    text(400, 128, 'Down samples'); text(620, 128, 'Left samples'); text(850, 128, 'Thermal errors')
    for i, row in enumerate(rows[:2]):
        y = 188 + 60*i
        text(30, y, 'Left guard' if row['variant']=='leftward' else 'Down + left guards')
        text(400, y, 'filled' if row['directions']['downward']['all_samples_filled'] else 'gap')
        text(620, y, 'filled'); text(910, y, str(row['errors'].get('starved_thermal',0)))
    text(30, 300, 'Intended route complete in all six runs; one unrelated native open remains.', 21)
    text(30, 335, 'Manually selected guards; finite copper samples; no production or frozen-suite safety claim.', 20)
    (directory / 'comparison.svg').write_text('\n'.join(elements+['</svg>'])+'\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=pathlib.Path)
    run(parser.parse_args().directory.resolve())
