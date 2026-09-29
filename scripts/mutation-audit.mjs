import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {analyzeMutation}=await server.ssrLoadModule('/src/protein/mutationTolerance.ts');
 const {determinant}=await server.ssrLoadModule('/src/protein/rigid.ts');
 const m=analyzeMutation(await readFile('src/data/structures/1BTL.pdb','utf8'),await readFile('src/data/structures/1JWP.pdb','utf8'));
 const audit={pairs:m.pairs.length,rmsd:m.alignment.rmsd,determinant:determinant(m.alignment.rotation),transform:m.alignment,unmatched:m.unmatched,
  chains:[m.wt,m.mutant].map(s=>({id:s.id,residues:s.residues.length,atoms:s.atoms.length,omitted:s.omitted,numberingGaps:Array.from({length:265},(_,i)=>i+26).filter(n=>!s.residues.some(r=>r.resSeq===n))})),
  headers:m.headers.map(h=>({method:h.method,resolution:h.resolution,missingResidues:h.missingResidues,missingAtoms:h.missingAtoms}))};
 await writeFile('artifacts/mutation-audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));
}finally{await server.close();}
