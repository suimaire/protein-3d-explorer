import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
// Use the project's existing TypeScript pipeline to audit the same geometry as the app.
await mkdir('artifacts',{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {buildBetaSheet,sheetHydrogenBonds,betaAngles,strandDirection}=await server.ssrLoadModule('/src/geometry/betaSheet.ts');
 const {classifyInteractions}=await server.ssrLoadModule('/src/geometry/sterics.ts');
 const audit={};
 for(const type of ['antiparallel','parallel']){const model=buildBetaSheet(type);audit[type]={model,directions:[0,1,2].map(s=>strandDirection(model,s)),torsions:[0,1,2].flatMap(s=>[1,2,3,4,5,6,7].map(r=>({strand:s,residue:r,...betaAngles(model,s,r)}))),displayed:sheetHydrogenBonds(model),...classifyInteractions(model)};}
 await writeFile('artifacts/beta-audit.json',JSON.stringify(audit,null,2));
 for(const [type,a] of Object.entries(audit))console.log(type,JSON.stringify({displayed:a.displayed.length,allHydrogenBonds:a.hydrogenBonds.length,rawOverlaps:a.severeOverlaps.length,seriousClashes:a.seriousClashes.length,ho:[Math.min(...a.displayed.map(b=>b.ho)),Math.max(...a.displayed.map(b=>b.ho))],angle:[Math.min(...a.displayed.map(b=>b.angle)),Math.max(...a.displayed.map(b=>b.angle))]}));
}finally{await server.close();}
