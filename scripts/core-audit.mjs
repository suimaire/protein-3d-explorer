import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
// Audit the same parser/SASA/grouping code the app uses.
await mkdir('artifacts',{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {ubiquitin,ubiquitinExposure,ubiquitinBonds}=await server.ssrLoadModule('/src/protein/ubiquitin.ts');
 const {groupIndices,composition,polarContacts}=await server.ssrLoadModule('/src/protein/exposure.ts');
 const started=performance.now(),exposure=ubiquitinExposure(),ms=performance.now()-started;
 const groups=Object.fromEntries(['buried','exposed'].map(g=>{const set=groupIndices(exposure.residues,g);return [g,{residues:exposure.residues.filter(r=>set.has(r.index)).sort((a,b)=>a.rank-b.rank).map(r=>`${r.resName}${r.resSeq}`),composition:composition(exposure.residues,set)}];}));
 const audit={structure:{id:ubiquitin.id,chain:ubiquitin.chain,residues:ubiquitin.residues.length,atoms:ubiquitin.atoms.length,bonds:ubiquitinBonds.length,omitted:ubiquitin.omitted,partialOccupancy:ubiquitin.residues.filter(r=>r.occupancy<1).map(r=>`${r.resName}${r.resSeq}:${r.occupancy}`)},total:exposure.total,ms,groups,
  residues:[...exposure.residues].sort((a,b)=>a.rank-b.rank).map(r=>({...r,polarContacts:polarContacts(ubiquitin,r.index)}))};
 await writeFile('artifacts/core-audit.json',JSON.stringify(audit,null,2));
 console.log(JSON.stringify({structure:audit.structure,total:audit.total.toFixed(2),ms:ms.toFixed(0),groups},null,1));
 for(const r of audit.residues)console.log(`${String(r.rank).padStart(2)} ${r.resName}${r.resSeq} ${r.chemical.padEnd(8)} rel ${(r.relative*100).toFixed(1)}% sasa ${r.sasa.toFixed(1)} side ${r.sideChainSasa.toFixed(1)}`);
}finally{await server.close();}
