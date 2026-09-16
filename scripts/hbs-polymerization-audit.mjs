import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
// Audit of the HbA → HbS → polymerization analysis with the same code the app uses (PDB 2HBS = HbS, 2DN2 = HbA).
await mkdir('artifacts',{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const hbsFile='src/data/structures/2HBS.pdb',hbaFile='src/data/structures/2DN2.pdb';
 const hbsText=await readFile(hbsFile,'utf8'),hbaText=await readFile(hbaFile,'utf8');
 const {analyzeSickle,sickleSceneModel,CONTACT_CUTOFF,NEIGHBOURHOOD_RADIUS,OVERLAP_CUTOFF,SEGMENT_CELLS}=await server.ssrLoadModule('/src/protein/sickle.ts');
 const {latticeAngles,latticeLengths}=await server.ssrLoadModule('/src/protein/crystal.ts');
 const {interfaceContacts,INTERFACE_CUTOFF}=await server.ssrLoadModule('/src/protein/quaternary.ts');
 const started=performance.now(),m=analyzeSickle(hbsText,hbaText),ms=performance.now()-started;
 const scene=sickleSceneModel(m);
 const round=(v,n=3)=>Number(v.toFixed(n)),vec=(v,n=3)=>v.map(x=>round(x,n));
 const sha=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
 const s=m.hbs.structure,name=r=>`${r.resName[0]}${r.resName.slice(1).toLowerCase()}${r.resSeq}`;
 const partner=q=>({residue:`${q.resName}${q.resSeq}`,chemical:q.chemical,role:q.role,
  minDistance:round(q.minDistance),atoms:`${q.donorAtom} … ${q.acceptorAtom}`,
  sideChainDistance:q.sideChainDistance===null?null:round(q.sideChainDistance),
  elements:`${s.atoms[q.donorAtomIndex].element}…${s.atoms[q.acceptorAtomIndex].element}`});
 const contact=c=>({
  donor:{molecule:c.donor.instance,chain:c.donor.sourceChain,residue:name(c.donor),key:c.donor.key},
  acceptor:{molecule:c.acceptor.instance,chain:c.acceptor.sourceChain},
  intermolecular:c.intermolecular,relation:c.relation,
  pocket:c.pocket.map(partner),
  secondary:c.secondary&&{pair:`${c.secondary.donorLabel} ${c.secondary.donorAtom} … ${c.secondary.acceptorLabel} ${c.secondary.acceptorAtom}`,minDistance:round(c.secondary.minDistance)},
  neighboursWithinCutoff:c.neighbours.map(q=>`${q.resName}${q.resSeq} ${round(q.minDistance,2)}`),
  closest:round(c.closest),
 });
 const out={
  sources:{
   hbs:{pdb:s.id,file:hbsFile,sha256:await sha(hbsFile),resolution:m.hbs.header.resolution,method:m.hbs.header.method,
    spaceGroup:m.hbs.crystal.spaceGroup,z:m.hbs.crystal.z,cell:m.hbs.crystal.cell,
    cellFromScale:{lengths:vec(latticeLengths(m.hbs.crystal),4),angles:vec(latticeAngles(m.hbs.crystal),4)},
    latticeVectors:{a:vec(m.hbs.crystal.lattice[0],4),b:vec(m.hbs.crystal.lattice[1],4),c:vec(m.hbs.crystal.lattice[2],4)},
    assemblies:m.hbs.assemblies,depositedChains:[...new Set(m.hbs.chains.map(c=>c.sourceChain))].sort(),
    missingResidues:m.hbs.header.missingResidues,missingAtomRecords:m.hbs.header.missingAtoms,omitted:m.hbs.omitted},
   hba:{pdb:m.hba.structure.id,file:hbaFile,sha256:await sha(hbaFile),resolution:m.hba.header.resolution,method:m.hba.header.method,
    assembly:m.hba.assembly,subunits:m.hba.subunits.map(x=>({label:x.label,chain:x.chain,type:x.type,uniprot:x.uniprot}))},
  },
  segment:{
   cells:SEGMENT_CELLS,
   instances:m.hbs.instances.map(i=>({id:i.id,label:i.label,assembly:i.assembly,cells:i.cells,operation:i.operation,deposited:i.deposited,
    chains:i.sourceChains,translation:vec(i.transform.translation,4),rotation:i.transform.rotation})),
   chains:m.hbs.chains.map(c=>({chain:c.chain,molecule:c.instance,deposited:c.sourceChain,label:c.label,type:c.type,uniprot:c.uniprot,residues:c.residues.length})),
   atoms:s.atoms.length,residues:s.residues.length,hemes:s.hetero.filter(g=>g.resName==='HEM').length,
   bonds:m.hbs.bonds.length,hemeBonds:m.hbs.hemeBonds.length,
   intermolecularBonds:m.hbs.bonds.filter(([a,b])=>m.hbs.chains.find(c=>c.chain===s.atoms[a].chain).instance!==m.hbs.chains.find(c=>c.chain===s.atoms[b].chain).instance).length,
   packing:{closestBetweenMolecules:round(m.packing.closest),overlapCutoff:OVERLAP_CUTOFF,overlappingPairs:m.packing.overlaps},
  },
  mutation:{
   nomenclature:'mature β-globin numbering (β6); the same variant is HBB p.Glu7Val in HGVS protein numbering, which counts the initiator Met',
   hba:{structure:m.mutation.hba.structure,chain:m.mutation.hba.chain,residue:name({resName:m.mutation.hba.resName,resSeq:m.mutation.hba.position}),
    chemical:m.mutation.hba.chemical,sideChainAtoms:m.mutation.hba.sideChain.map(i=>m.hba.structure.atoms[i].name)},
   hbs:{structure:m.mutation.hbs.structure,molecule:m.mutation.hbs.instance,chain:m.mutation.hbs.sourceChain,
    residue:name({resName:m.mutation.hbs.resName,resSeq:m.mutation.hbs.position}),chemical:m.mutation.hbs.chemical,
    sideChainAtoms:m.mutation.hbs.sideChain.map(i=>s.atoms[i].name),key:m.mutation.hbs.key},
   alignment:{atoms:'Cα',matched:m.mutation.alignment.matched,rmsd:round(m.mutation.alignment.rmsd),
    maxDeviation:round(m.mutation.alignment.maxDeviation),determinant:round(m.mutation.alignment.determinant,12),
    rotation:m.mutation.alignment.transform.rotation.map(r=>vec(r,6)),translation:vec(m.mutation.alignment.transform.translation)},
   differences:m.mutation.differences,
   neighbourhood:{radius:NEIGHBOURHOOD_RADIUS,hba:m.mutation.neighbourhood.hba.length,hbs:m.mutation.neighbourhood.hbs.length},
   chainFits:m.mutation.chainFits.map(f=>({chain:f.sourceChain,molecule:f.instance,label:f.label,type:f.type,reference:f.reference,matched:f.matched,rmsd:round(f.rmsd)})),
   tetramerFits:m.mutation.tetramerFits.map(f=>({molecule:f.instance,matched:f.matched,rmsd:round(f.rmsd)})),
  },
  contacts:{criterion:`heavy-atom distance ≤ ${CONTACT_CUTOFF} Å; geometric proximity only — not an interaction type and never a covalent bond`,
   primary:contact(m.primary),all:m.contacts.map(contact),
   unengagedDonors:m.unengagedDonors.map(u=>({molecule:u.instance,chain:u.sourceChain})),
   guides:scene.contact.guides.map(g=>({kind:g.kind,distance:round(g.distance),
    from:`${s.atoms[g.a].chain} ${s.atoms[g.a].name}`,to:`${s.atoms[g.b].chain} ${s.atoms[g.b].name}`})),
   segmentJunctions:scene.segmentContacts.map(c=>({donor:c.donorInstance,acceptor:c.acceptorInstance,closest:round(c.distance)})),
   // Every contact between two molecules in the segment, not only the βVal6 one: the polymer is held together by a
   // network. "Lateral" = between the two biomolecules (the two strands); "axial" = between copies of one biomolecule
   // along the repeat. Only the βVal6 junctions involve the mutation site.
   contactNetwork:{cutoff:m.network.cutoff,lateral:m.network.lateral,axial:m.network.axial,involvingMutation:m.network.involvingMutation},
   intermolecularInterfaces:(()=>{
    const chainOf=new Map(m.hbs.chains.map(c=>[c.chain,c]));
    const assemblyOf=c=>m.hbs.instances.find(i=>i.id===chainOf.get(c).instance).assembly;
    const val6=new Set(m.contacts.map(c=>`${c.donor.chain}|${c.acceptor.chain}`));
    return interfaceContacts(s).pairs
     .filter(p=>chainOf.get(p.chains[0]).instance!==chainOf.get(p.chains[1]).instance)
     .map(p=>({pair:p.chains.map(c=>`${chainOf.get(c).instance}/${chainOf.get(c).sourceChain}`).join(' – '),
      kind:assemblyOf(p.chains[0])===assemblyOf(p.chains[1])?'axial (same strand)':'lateral (between strands)',
      involvesVal6:val6.has(`${p.chains[0]}|${p.chains[1]}`)||val6.has(`${p.chains[1]}|${p.chains[0]}`),
      residues:[p.residues[0].length,p.residues[1].length],atomPairs:p.atomPairs}))
     .sort((a,b)=>b.atomPairs-a.atomPairs);
   })(),
   interfaceCutoff:INTERFACE_CUTOFF,
  },
  representation:{
   atomic:'deoxy HbS crystal coordinates (2HBS) and exact unit-cell translations of them',
   schematic:'higher-order fiber cross-section (7 double strands = 14 strands) drawn as a diagram, labelled SCHEMATIC, not atomic coordinates',
   notSimulated:['polymerization kinetics','nucleation','diffusion or binding pathway','molecular dynamics','red-blood-cell mechanics'],
  },
  analysisMs:round(ms,1),
  // Displayed sample coordinates, for browser endpoint-exactness checks.
  samples:{
   hbs:{atom:`${s.atoms[scene.contact.donorSideChain[0]].chain}:${s.atoms[scene.contact.donorSideChain[0]].resSeq}:${s.atoms[scene.contact.donorSideChain[0]].name}`,
    position:s.atoms[scene.contact.donorSideChain[0]].position},
   hba:{atom:`${m.hba.structure.atoms[m.mutation.hba.caAtom].chain}:${m.hba.structure.atoms[m.mutation.hba.caAtom].resSeq}:${m.hba.structure.atoms[m.mutation.hba.caAtom].name}`,
    deposited:m.hba.structure.atoms[m.mutation.hba.caAtom].position,aligned:vec(m.mutation.hbaPositions[m.mutation.hba.caAtom],6)},
  },
 };
 await writeFile('artifacts/hbs-polymerization-audit.json',JSON.stringify(out,null,1));
 console.log(JSON.stringify({...out,segment:{...out.segment,chains:out.segment.chains.length},contacts:{...out.contacts,all:out.contacts.all.length}},null,1));
}finally{await server.close();}
