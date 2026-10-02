import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const text=await readFile('src/data/structures/7RSA.pdb','utf8'),{analyzeRnase}=await server.ssrLoadModule('/src/protein/rnase.ts'),m=analyzeRnase(text);
 const audit={sha256:createHash('sha256').update(text).digest('hex'),source:{id:m.structure.id,resolution:m.header.resolution,method:m.header.method,assemblies:m.header.assemblies,missingResidues:m.header.missingResidues,missingAtoms:m.header.missingAtoms,annotationCount:m.depositedDisulfideRecords.length},atoms:m.structure.atoms.length,residues:m.structure.residues.length,omitted:m.structure.omitted,alternates:m.alternateChoices,disulfides:m.disulfides,
 mapping:m.structure.residues.map(r=>({index:r.index,chain:r.chain,authorNumber:r.resSeq,insertionCode:r.insertionCode,sequenceIndex:m.positions.get(r.index)}))};
 await mkdir('artifacts/protein-additions',{recursive:true});await writeFile('artifacts/protein-additions/rnase-audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify({...audit,mapping:undefined},null,2));
}finally{await server.close();}
