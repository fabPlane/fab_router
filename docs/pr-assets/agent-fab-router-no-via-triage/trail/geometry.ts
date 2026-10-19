import {route, checkDrc, requiredConnections} from './src/api.ts';
import {trailFallbackBoard} from './test/helpers/trail-fallback-board.ts';
const layout=trailFallbackBoard();
const report=route(layout,{viasAllowed:false,fanoutEnabled:false,ripupEnabled:false,optimizerEnabled:false,maxPasses:1,neckWidthUm:0});
console.log(JSON.stringify({pads:layout.pads,tracks:layout.tracks,padForms:layout.padForms.map(p=>({...p,perSheet:[...p.perSheet]})),report,opens:requiredConnections(layout).length,violations:checkDrc(layout).violations},null,2));
