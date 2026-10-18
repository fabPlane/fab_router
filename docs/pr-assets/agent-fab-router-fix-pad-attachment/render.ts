import { route } from '../../../src/api.ts';
import { padAttachmentBoard } from '../../../test/helpers/pad-attachment-board.ts';
const before = padAttachmentBoard(), after = padAttachmentBoard();
const report = route(after, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
const sx = (x: number) => 110 + x / 100, sy = (y: number) => 150 - y / 100;
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="440" viewBox="0 0 1400 440"><rect width="1400" height="440" fill="#101925"/>';
for (const [i, layout] of [before, after].entries()) {
  svg += `<g transform="translate(${i * 700 + 35} 70)"><text x="0" y="-25" fill="white" font-family="sans-serif" font-size="22">${i ? 'After: full-width pad edge attachment' : 'Before: pad centre blocked, net open'}</text>`;
  for (const p of layout.pads) {
    const w = p.form === 100 ? 200 : 20;
    svg += `<rect x="${sx(p.at.x) - w / 2}" y="${sy(p.at.y) - 10}" width="${w}" height="20" fill="${p.net === 0 ? '#f7c562' : '#e46d76'}"/>`;
  }
  for (const t of layout.tracks) svg += `<polyline points="${t.pts.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')}" stroke="#7ce1b1" stroke-width="${t.width / 100}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.75"/>`;
  svg += `<circle cx="${sx(0)}" cy="${sy(0)}" r="40" fill="none" stroke="#f29191" stroke-dasharray="5 4" stroke-width="2"/><text x="0" y="290" fill="#cad5e2" font-family="sans-serif" font-size="17">${i ? `Open nets: ${report.incompleteAfter}; track width: 0.8 mm; no necking` : 'Dashed circle: 0.8 mm track end at centre hits neighbours'}</text></g>`;
}
svg += '<text x="35" y="420" fill="#cad5e2" font-family="sans-serif" font-size="16">Synthetic geometry at scale; gold: power pads; red: other copper; green: emitted track</text></svg>';
await Bun.write(new URL('./attachment.svg', import.meta.url), svg);
console.log(JSON.stringify({report,tracks:after.tracks},null,2));
