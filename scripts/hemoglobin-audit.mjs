import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
// Audit the same parser / chain mapping / heme association / interface code the app uses (PDB 2DN2).
await mkdir('artifacts',{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const text=await readFile('src/data/structures/2DN2.pdb','utf8');
 const {analyzeHemoglobin,residueLabel,EXPLODED_DISTANCE}=await server.ssrLoadModule('/src/protein/hemoglobin.ts');
 const {interfaceContacts,centroid}=await server.ssrLoadModule('/src/protein/quaternary.ts');
 const started=performance.now(),model=analyzeHemoglobin(text),ms=performance.now()-started;
 const {structure,header}=model,atoms=structure.atoms,label=Object.fromEntries(model.subunits.map(s=>[s.chain,s.label]));
 const round=(v,n=2)=>Number(v.toFixed(n));
 const subunits=model.subunits.map(s=>{
  const residues=s.residues.map(i=>structure.residues[i]);
  return {label:s.label,chain:s.chain,type:s.type,uniprot:s.uniprot,entry:s.entry,molecule:s.molecule,sequenceLength:s.sequenceLength,modeledResidues:s.modeledResidues,
   range:[s.firstResSeq,s.lastResSeq],heavyAtoms:residues.reduce((n,r)=>n+r.atoms.length,0),helixResidues:residues.filter(r=>r.secondary==='helix'||r.secondary==='helix310').length,strandResidues:residues.filter(r=>r.secondary==='strand').length,
   heme:{number:s.heme.number,record:`${s.heme.resName} ${s.heme.fileChain} ${s.heme.resSeq}`,atoms:s.heme.atomCount,contacts:s.heme.association.contacts,minDistance:Object.fromEntries(Object.entries(s.heme.association.minDistance).map(([k,v])=>[k,round(v)])),
    iron:atoms[s.heme.iron].position,proximal:`${residueLabel(structure.residues[s.heme.proximal.residue])} ${s.heme.proximal.atomName} (chain ${s.heme.proximal.chain})`,feLigandDistance:round(s.heme.proximal.distance,3),
    ironToChainCentroid:round(Math.hypot(...atoms[s.heme.iron].position.map((v,k)=>v-centroid(atoms,residues.flatMap(r=>r.atoms))[k])),1)}};
 });
 const links=header.links.map(l=>`${l.a.name} ${l.a.resName} ${l.a.chain}${l.a.resSeq} – ${l.b.name} ${l.b.resName} ${l.b.chain}${l.b.resSeq} ${l.distance} Å`);
 const pairs=(analysis)=>analysis.pairs.map(p=>({chains:p.chains.join('-'),labels:`${label[p.chains[0]]}–${label[p.chains[1]]}`,residues:[p.residues[0].length,p.residues[1].length],atomPairs:p.atomPairs}));
 const sensitivity=[3.5,4.0,4.5,5.0].map(cutoff=>({cutoff,pairs:pairs(interfaceContacts(structure,cutoff))}));
 const iface=model.interfaces;
 const out={
  pdb:{id:structure.id,sha256:createHash('sha256').update(await readFile('src/data/structures/2DN2.pdb')).digest('hex'),method:header.method,resolution:header.resolution},
  assembly:model.assembly,chains:structure.chains,omitted:structure.omitted,missingResidues:header.missingResidues,missingAtoms:header.missingAtoms,
  altlocAtoms:atoms.filter(a=>a.altLoc).length,partialOccupancyAtoms:atoms.filter(a=>a.occupancy<1).length,
  hetero:structure.hetero.map(g=>({record:`${g.resName} ${g.chain} ${g.resSeq}`,atoms:g.atoms.length,owner:model.hetero[g.index]})),
  polymerHeavyAtoms:structure.residues.reduce((n,r)=>n+r.atoms.length,0),heteroAtoms:structure.hetero.reduce((n,r)=>n+r.atoms.length,0),
  ironAtoms:atoms.filter(a=>a.element==='FE').length,subunits,links,
  interfaces:{cutoff:iface.cutoff,pairs:pairs(iface),interfaceResidues:iface.partners.size,
   residues:Object.fromEntries(iface.pairs.map(p=>[p.chains.join('-'),p.residues.map(list=>list.map(i=>{const r=structure.residues[i];return `${r.chain}${r.resSeq}${r.insertionCode}`;}))]))},
  sensitivity,exploded:{distance:EXPLODED_DISTANCE,offsets:Object.fromEntries(Object.entries(model.exploded).map(([k,v])=>[k,v.map(x=>round(x,3))]))},
  bonds:{polymer:model.bonds.length,heme:model.hemeBonds.length},analysisMs:round(ms,1),
 };
 await writeFile('artifacts/hemoglobin-audit.json',JSON.stringify(out,null,1));
 console.log(JSON.stringify({...out,interfaces:{...out.interfaces,residues:'(see artifacts/hemoglobin-audit.json)'}},null,1));
}finally{await server.close();}
