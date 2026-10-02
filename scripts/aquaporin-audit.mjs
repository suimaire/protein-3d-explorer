import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const text=await readFile('src/data/structures/1J4N.pdb','utf8'),q=await server.ssrLoadModule('/src/protein/aquaporin.ts'),m=q.analyzeAquaporin(text);
 const all=m.subunits.flatMap(u=>u.structure.atoms);let minimum=Infinity,radial=Infinity,maxStep=0;
 for(const u of m.subunits)for(let j=0;j<=2120;j++){const p=q.channelPoint(u.path,j/2120);minimum=Math.min(minimum,q.channelClearance(all,p));radial=Math.min(radial,Math.hypot(p[0]-m.axis[0],p[1]-m.axis[1]));if(j){const prev=q.channelPoint(u.path,(j-1)/2120);maxStep=Math.max(maxStep,Math.hypot(...p.map((x,k)=>x-prev[k])));}}
 const audit={sha256:createHash('sha256').update(text).digest('hex'),source:{id:m.source.id,method:m.header.method,resolution:m.header.resolution,seqres:Object.fromEntries(m.header.seqres),missingResidues:m.header.missingResidues,missingAtoms:m.header.missingAtoms,omitted:m.source.omitted,alternates:m.alternateChoices},
 assembly:m.assembly,alternativeAssemblies:m.header.assemblies.filter(a=>a.id!==1),npa:m.npa.map(i=>m.source.residues[i]),arr:m.arr.map(i=>m.source.residues[i]),waters:m.subunits[0].waters,waterContacts:m.waterContacts,
 path:{points:m.sourcePath.length,samplesPerSubunit:2121,minimumVdwClearance:minimum,minimumCentralAxisDistance:radial,maximumSampleSpacing:maxStep,continuousClearanceLowerBound:minimum-maxStep,glyphRadius:q.AQP1_PARTICLE_RADIUS},
 mapping:m.subunits.map(u=>({operator:u.index+1,center:u.center,residues:m.source.residues.map(r=>({index:r.index,instance:q.aqpInstanceKey(u.index,r.chain,r.resSeq,r.insertionCode),chain:r.chain,resSeq:r.resSeq,insertionCode:r.insertionCode,name:r.resName}))})),
 regions:m.regions.map(rs=>rs.map(r=>({...r,name:m.source.residues[r.index].resName,resSeq:m.source.residues[r.index].resSeq})))};
 await mkdir('artifacts/protein-additions',{recursive:true});await writeFile('artifacts/protein-additions/aquaporin-audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify({sha256:audit.sha256,assembly:audit.assembly,path:audit.path,waterContacts:audit.waterContacts},null,2));
}finally{await server.close();}
