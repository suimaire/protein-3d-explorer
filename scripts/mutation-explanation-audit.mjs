import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {analyzeMutation,TEM1_SITES}=await server.ssrLoadModule('/src/protein/mutationTolerance.ts');
 const {measureMutationEvidence}=await server.ssrLoadModule('/src/protein/mutationEvidence.ts');
 const model=analyzeMutation(await readFile('src/data/structures/1BTL.pdb','utf8'),await readFile('src/data/structures/1JWP.pdb','utf8'));
 const evidence=measureMutationEvidence(model),audit={globalRmsd:model.alignment.rmsd,globalCount:model.pairs.length,...evidence,sites:TEM1_SITES};
 await writeFile('artifacts/mutation-explanation-audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));
}finally{await server.close();}
