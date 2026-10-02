import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {ubiquitin:s,ubiquitinSequence}=await server.ssrLoadModule('/src/protein/ubiquitin.ts');
 const {sequencePositions,sequenceSpaceExamples,atomIdentifier}=await server.ssrLoadModule('/src/protein/sequenceSpace.ts');
 const positions=sequencePositions(s,ubiquitinSequence),examples=sequenceSpaceExamples(s,positions).map(p=>({...p,atomLabelA:atomIdentifier(s,p.atomA),atomLabelB:atomIdentifier(s,p.atomB)}));
 await mkdir('artifacts/protein-additions',{recursive:true});
 await writeFile('artifacts/protein-additions/sequence-space-audit.json',JSON.stringify({mapping:s.residues.map(r=>({index:r.index,chain:r.chain,authorNumber:r.resSeq,insertionCode:r.insertionCode,sequenceIndex:positions.get(r.index)})),examples},null,2));
 console.log(JSON.stringify(examples,null,2));
}finally{await server.close();}
