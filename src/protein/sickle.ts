import type {Vec} from '../geometry/vector';
import {classOf,type ChemicalClass} from './chemistry';
import {inferBonds} from './exposure';
import {parseMultiChainPdb,parsePdbHeader,type MultiChainStructure,type PdbAtom,type PdbHeader,type PdbResidue} from './pdb';
import {analyzeHemoglobin,GLOBIN_BY_UNIPROT,HEMOGLOBIN_SOURCE,SUBUNIT_ORDER,type GlobinType,type HemoglobinModel,type SubunitLabel} from './hemoglobin';
import {associateHetero,buildCopies,centroid,interfaceContacts,pairBetween,INTERFACE_CUTOFF,type InterfaceAnalysis,type StructureCopy} from './quaternary';
import {latticeLabel,latticeTransform,parseCrystalFrame,type CrystalFrame} from './crystal';
import {applyRigid,determinant,fitRigid,type RigidTransform} from './rigid';

/**
 * HbS endpoint: RCSB 2HBS (Harrington, Adachi & Royer Jr 1997), human deoxyhemoglobin S, X-ray 2.05 Å, space group
 * P 1 21 1. The asymmetric unit holds two complete α2βS2 tetramers (REMARK 350 biomolecule 1 = chains A–D,
 * biomolecule 2 = chains E–H), both under the identity operator, so each tetramer is the deposited coordinates.
 */
export const HBS_SOURCE={pdbId:'2HBS',protein:'Hemoglobin S (deoxy)',organism:'Homo sapiens',method:'X-ray diffraction',resolution:2.05,
 state:'deoxy (no ligand deposited on any heme Fe)',spaceGroup:'P 1 21 1',
 doi:'10.1006/jmbi.1997.1253',citation:'Harrington, Adachi & Royer Jr (1997) J. Mol. Biol. 272:398–407',
 sha256:'b552883a48cd11bf8bc86785cc7ab5e49203e4c0dae922aaf2cc489421cd5c09'} as const;
/** HbA reference: the Phase 4A/4B T-state structure (PDB 2DN2), reused unchanged. */
export const HBA_SOURCE={...HEMOGLOBIN_SOURCE,stateLabel:'HbA · deoxy (T-like)'} as const;

/**
 * Mature β-globin numbering — the traditional hemoglobin convention, and the residue numbering used by both deposited
 * files: β6 is the sickle site. Modern HGVS protein notation counts the initiator methionine, so the same variant is
 * written HBB p.Glu7Val there; the student UI uses β6 only and never mixes the two systems.
 */
export const MUTATION_POSITION=6;
export const HBA_MUTATION_RESIDUE='GLU',HBS_MUTATION_RESIDUE='VAL';
/** Acceptor pocket of the lateral contact, β-globin numbering: the three nonpolar residues named in the literature. */
export const POCKET_CORE:readonly number[]=[70,85,88];
/** Polar residues at the rim of the same pocket. Measured and reported separately from the nonpolar core. */
export const POCKET_PERIPHERY:readonly number[]=[84,73];
/** Donor-side residue of the secondary polar interaction (βThr4 of the donor ↔ βAsp73 of the acceptor). */
export const SECONDARY_DONOR_POSITION=4,SECONDARY_ACCEPTOR_POSITION=73;
/**
 * Contact criterion: heavy-atom distance ≤ 4.5 Å. Purely geometric proximity — on its own it does not identify the
 * kind of noncovalent interaction, and it is never a covalent bond.
 */
export const CONTACT_CUTOFF=4.5;
/** Radius around the β6 side chain used for the local surface-chemistry comparison. */
export const NEIGHBOURHOOD_RADIUS=10;
/** Unit-cell translations that build the short repeating segment, in display order. */
export const SEGMENT_CELLS:[number,number,number][]=[[-1,0,0],[0,0,0],[1,0,0]];
/** Closest approach below which two molecules would be considered to overlap. */
export const OVERLAP_CUTOFF=2.5;

export type MoleculeInstance={
 /** Unique instance ID; part of every residue and atom key in this module. */ id:string;
 /** Student-facing name. */ label:string;
 /** REMARK 350 biomolecule copied. */ assembly:number;
 /** Unit-cell translation applied to the deposited coordinates. */ cells:[number,number,number];
 /** Crystallographic operation, e.g. `x, y, z` or `x−a, y, z`. */ operation:string;
 /** Deposited chain IDs. */ sourceChains:string[];
 /** Chain IDs inside the built structure (`<instance>/<source>`). */ chains:string[];
 /** Rigid transform applied; every lattice translation has the identity rotation. */ transform:RigidTransform;
 /** True for the deposited asymmetric unit (no translation). */ deposited:boolean;
};
export type SickleChain={
 chain:string;instance:string;sourceChain:string;type:GlobinType;uniprot:string;entry:string;
 /** Educational subunit label inside its own tetramer (Phase 4A rule). */ label:SubunitLabel;
 /** Residue indices of this chain, in sequence order. */ residues:number[];
 /** Hetero-group index of this chain's heme, and its Fe atom. */ heme:number;iron:number;
};

/** Residue identity across molecule instances: structure + instance + deposited chain + number + insertion code + name. */
export const moleculeResidueKey=(structureId:string,instance:string,sourceChain:string,r:{resSeq:number;insertionCode:string;resName:string})=>
 `${structureId}|${instance}|${sourceChain}:${r.resSeq}${r.insertionCode}:${r.resName}`;
/** The same identity for one atom. */
export const moleculeAtomKey=(structureId:string,instance:string,sourceChain:string,r:{resSeq:number;insertionCode:string;resName:string},atomName:string)=>
 `${moleculeResidueKey(structureId,instance,sourceChain,r)}:${atomName}`;

export type MutationSite={
 structure:string;instance:string|null;chain:string;sourceChain:string;
 /** Mature β-globin position. */ position:number;
 resName:string;chemical:ChemicalClass;residue:number;
 /** Side-chain heavy atoms (everything beyond N, CA, C, O, OXT). */ sideChain:number[];
 caAtom:number;key:string;
};
export type ChainFit={chain:string;instance:string;sourceChain:string;type:GlobinType;label:SubunitLabel;reference:string;matched:number;rmsd:number};
export type MutationComparison={
 hba:MutationSite;hbs:MutationSite;
 /** Cα superposition of the whole HbA β chain onto the HbS donor β chain; the deposited HbA file is never changed. */
 alignment:{matched:number;rmsd:number;maxDeviation:number;determinant:number;transform:RigidTransform};
 /** Residue positions where the two aligned β chains differ. */ differences:{position:number;hba:string;hbs:string}[];
 /** HbA atom coordinates after that superposition (computed at runtime). */ hbaPositions:Vec[];
 /** Residue indices of the two aligned β chains, in sequence order. */ hbaChainResidues:number[];hbsChainResidues:number[];
 /** Residues whose heavy atoms come within `radius` Å of the β6 side chain, in each structure. */
 neighbourhood:{radius:number;hba:number[];hbs:number[]};
 /** Independent Cα fit of every deposited HbS chain onto its HbA counterpart of the same globin type. */ chainFits:ChainFit[];
 /** Whole-tetramer Cα fit of each deposited HbS tetramer onto the HbA tetramer. */ tetramerFits:{instance:string;matched:number;rmsd:number}[];
};

export type ContactPartner={
 instance:string;chain:string;sourceChain:string;residue:number;resSeq:number;resName:string;chemical:ChemicalClass;
 /** `core` = the three nonpolar pocket residues; `peripheral` = the polar rim; `other` = any further neighbour. */
 role:'core'|'peripheral'|'other';
 /** Shortest heavy-atom distance to the donor residue, and the atoms that realise it. */
 minDistance:number;donorAtom:string;acceptorAtom:string;donorAtomIndex:number;acceptorAtomIndex:number;
 /** The same, restricted to side-chain heavy atoms on both sides; null when one side has none. */ sideChainDistance:number|null;
};
export type SecondaryContact={donorResidue:number;acceptorResidue:number;donorLabel:string;acceptorLabel:string;
 minDistance:number;donorAtom:string;acceptorAtom:string;donorAtomIndex:number;acceptorAtomIndex:number};
export type PathologicalContact={
 donor:{instance:string;chain:string;sourceChain:string;residue:number;resSeq:number;resName:string;sideChain:number[];key:string};
 acceptor:{instance:string;chain:string;sourceChain:string;key:string};
 /** Checked, not assumed: donor and acceptor belong to different molecule instances. */ intermolecular:boolean;
 /** How the acceptor instance relates to the donor instance. */ relation:string;
 /** Ala70, Phe85, Leu88 then Thr84, Asp73 — measured, in that order. */ pocket:ContactPartner[];
 /** Every acceptor-chain residue within `CONTACT_CUTOFF` of the donor residue, nearest first. */ neighbours:ContactPartner[];
 /** βThr4 (donor) ↔ βAsp73 (acceptor), measured; null if it is absent. */ secondary:SecondaryContact|null;
 /** Shortest heavy-atom distance anywhere in the contact. */ closest:number;
};

export type SickleModel={
 hbs:{
  /** Every molecule instance of the short repeating segment, in display order. */ instances:MoleculeInstance[];
  structure:MultiChainStructure;header:PdbHeader;crystal:CrystalFrame;
  chains:SickleChain[];bonds:[number,number][];hemeBonds:[number,number][];
  /** REMARK 350 biomolecules, as deposited. */ assemblies:{id:number;chains:string[];identity:boolean}[];
  omitted:MultiChainStructure['omitted'];
 };
 /** HbA reference, analysed by the Phase 4A code so its assembly, chain types, heme and labels are validated the same way. */
 hba:HemoglobinModel&{betaChain:string};
 mutation:MutationComparison;
 /** Every βVal6 → neighbouring-β-chain pocket contact found in the segment, nearest first. */ contacts:PathologicalContact[];
 /** The contact shown to students: the one inside the deposited asymmetric unit. */ primary:PathologicalContact;
 /** βVal6 residues that engage no pocket in this segment — not every copy of the mutation is in a contact. */
 unengagedDonors:{instance:string;chain:string;sourceChain:string;residue:number}[];
 /** Closest heavy-atom approach between different molecule instances, and how many pairs fall below the overlap cutoff. */
 packing:{closest:number;overlapCutoff:number;overlaps:number};
 /**
  * Every chain-pair contact between different molecules in the segment — measured, so the βVal6 contact is placed in
  * the network it belongs to. `lateral` = between the two biomolecules (the two strands); `axial` = between copies of
  * one biomolecule along the repeat, which do not involve the mutation site.
  */
 network:{cutoff:number;lateral:number;axial:number;involvingMutation:number;
  interfaces:{chains:[string,string];instances:[string,string];sourceChains:[string,string];
   kind:'lateral'|'axial';involvesMutation:boolean;residues:[number,number];atomPairs:number}[]};
};

const d2=(a:Vec,b:Vec)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const BACKBONE=new Set(['N','CA','C','O','OXT']);
function fail(message:string):never{throw new Error(`HbS validation: ${message}`);}

const cellSuffix=(cells:[number,number,number],minus:string)=>
 cells.map((v,k)=>v===0?'':`${v>0?'+':minus}${Math.abs(v)===1?'':Math.abs(v)}${'abc'[k]}`).filter(Boolean);
const instanceId=(assembly:number,cells:[number,number,number])=>`M${assembly}${cellSuffix(cells,'-').join('')}`;
const instanceLabel=(assembly:number,cells:[number,number,number])=>{
 const suffix=cellSuffix(cells,'−');
 return suffix.length?`Molecule ${assembly} ${suffix.join(' ')}`:`Molecule ${assembly}`;
};

/** Globin type of every deposited chain, from its own UniProt DBREF (never the chain letter). */
function globinTypes(header:PdbHeader,chains:string[],what:string){
 const types=new Map<string,{type:GlobinType;uniprot:string;entry:string}>();
 for(const chain of chains){
  const refs=header.dbref.filter(d=>d.chain===chain&&d.database==='UNP');
  if(refs.length!==1)fail(`${what} chain ${chain} needs exactly one UniProt DBREF`);
  const globin=GLOBIN_BY_UNIPROT[refs[0].accession];
  if(!globin||globin.entry!==refs[0].idCode)fail(`${what} chain ${chain} is ${refs[0].accession} ${refs[0].idCode}, not a human α/β globin`);
  // Mature-globin numbering: the file must number residues exactly as the reference sequence does.
  if(refs[0].seqBegin!==refs[0].dbBegin)fail(`${what} chain ${chain} residue numbering is offset from its reference sequence`);
  types.set(chain,{type:globin.type,uniprot:refs[0].accession,entry:refs[0].idCode});
 }
 return types;
}

const sideChainOf=(structure:MultiChainStructure,r:PdbResidue)=>r.atoms.filter(i=>!BACKBONE.has(structure.atoms[i].name));
/** Shortest distance between two atom sets, with the atom pair that realises it. */
function closestPair(structure:MultiChainStructure,a:number[],b:number[]){
 let best=Infinity,pair:[number,number]|null=null;
 for(const i of a){const p=structure.atoms[i].position;
  for(const j of b){const v=d2(p,structure.atoms[j].position);if(v<best){best=v;pair=[i,j];}}}
 return pair?{distance:Math.sqrt(best),atoms:pair}:null;
}
/** Chain ID + residue number → residue, built once so contact discovery never scans the whole segment. */
const residueIndex=(structure:MultiChainStructure)=>{
 const map=new Map<string,PdbResidue>();
 for(const r of structure.residues)if(r.insertionCode==='')map.set(`${r.chain}:${r.resSeq}`,r);
 return (chain:string,resSeq:number)=>map.get(`${chain}:${resSeq}`);
};

/**
 * Educational subunit labels inside one tetramer, by the same rule the Phase 4A module uses: α1 = the first α chain in
 * the file, β1 = the β chain with the larger α1 contact (the tight α1β1 packing interface), α2 / β2 = the other two.
 */
function labelTetramer(interfaces:InterfaceAnalysis,alphas:string[],betas:string[]):Record<string,SubunitLabel>{
 if(alphas.length!==2||betas.length!==2)fail(`a tetramer needs 2 α and 2 β chains, found α${alphas.length} β${betas.length}`);
 const size=(a:string,b:string)=>{const p=pairBetween(interfaces,a,b);return p?p.residues[0].length+p.residues[1].length:0;};
 const [alpha1,alpha2]=alphas,sorted=[...betas].sort((a,b)=>size(alpha1,b)-size(alpha1,a));
 if(size(alpha1,sorted[0])===size(alpha1,sorted[1]))fail(`α ${alpha1} contacts both β chains equally; α1β1 is ambiguous`);
 return {[alpha1]:'α1',[sorted[0]]:'β1',[alpha2]:'α2',[sorted[1]]:'β2'};
}

/** How two instances are related: the same deposited unit, or one unit-cell translation apart. */
function relationOf(donor:MoleculeInstance,acceptor:MoleculeInstance){
 const delta=acceptor.cells.map((v,k)=>v-donor.cells[k]) as [number,number,number];
 const between=`biomolecule ${donor.assembly} → biomolecule ${acceptor.assembly}`;
 return delta.every(v=>v===0)?`${between}, same deposited asymmetric unit (${latticeLabel([0,0,0])})`
  :`${between}, acceptor translated by ${latticeLabel(delta)}`;
}

/**
 * Finds every βVal6 → neighbouring-β-chain pocket contact from the coordinates alone. A contact is reported when the
 * donor Val6 and all three nonpolar pocket residues (βAla70, βPhe85, βLeu88) of a β chain belonging to a *different*
 * molecule instance are each within `CONTACT_CUTOFF`. Donor and acceptor chains are discovered, never assumed.
 */
function findContacts(structure:MultiChainStructure,chains:SickleChain[],instances:MoleculeInstance[],cutoff:number){
 const at=residueIndex(structure),byId=new Map(instances.map(i=>[i.id,i])),byChain=new Map(chains.map(c=>[c.chain,c]));
 const partner=(donor:PdbResidue,acceptor:PdbResidue,role:ContactPartner['role']):ContactPartner=>{
  const whole=closestPair(structure,donor.atoms,acceptor.atoms)!,side=closestPair(structure,sideChainOf(structure,donor),sideChainOf(structure,acceptor));
  const c=byChain.get(acceptor.chain)!;
  return {instance:c.instance,chain:c.chain,sourceChain:c.sourceChain,residue:acceptor.index,resSeq:acceptor.resSeq,resName:acceptor.resName,
   chemical:classOf(acceptor.resName),role,minDistance:whole.distance,donorAtom:structure.atoms[whole.atoms[0]].name,
   acceptorAtom:structure.atoms[whole.atoms[1]].name,donorAtomIndex:whole.atoms[0],acceptorAtomIndex:whole.atoms[1],
   sideChainDistance:side?side.distance:null};
 };
 const label=(r:PdbResidue)=>`${r.resName[0]}${r.resName.slice(1).toLowerCase()}${r.resSeq}`;
 const betas=chains.filter(c=>c.type==='beta');
 const contacts:PathologicalContact[]=[],unengaged:SickleModel['unengagedDonors']=[];
 for(const donorChain of betas){
  const donor=at(donorChain.chain,MUTATION_POSITION);
  if(!donor)fail(`chain ${donorChain.chain} has no residue ${MUTATION_POSITION}`);
  if(donor.resName!==HBS_MUTATION_RESIDUE)fail(`${donorChain.sourceChain} β${MUTATION_POSITION} is ${donor.resName}, not ${HBS_MUTATION_RESIDUE}`);
  let engaged=false;
  for(const acceptorChain of betas){
   if(acceptorChain.instance===donorChain.instance)continue;
   const core=POCKET_CORE.map(p=>{const r=at(acceptorChain.chain,p);if(!r)fail(`chain ${acceptorChain.chain} has no residue ${p}`);return partner(donor,r,'core');});
   if(core.some(m=>m.minDistance>cutoff))continue;
   engaged=true;
   const periphery=POCKET_PERIPHERY.map(p=>at(acceptorChain.chain,p)).filter((r):r is PdbResidue=>!!r).map(r=>partner(donor,r,'peripheral'));
   const neighbours=structure.residues.filter(r=>r.chain===acceptorChain.chain)
    .map(r=>partner(donor,r,POCKET_CORE.includes(r.resSeq)?'core':POCKET_PERIPHERY.includes(r.resSeq)?'peripheral':'other'))
    .filter(p=>p.minDistance<=cutoff).sort((a,b)=>a.minDistance-b.minDistance);
   const thr4=at(donorChain.chain,SECONDARY_DONOR_POSITION),asp73=at(acceptorChain.chain,SECONDARY_ACCEPTOR_POSITION);
   const pair=thr4&&asp73?closestPair(structure,sideChainOf(structure,thr4),sideChainOf(structure,asp73)):null;
   contacts.push({
    donor:{instance:donorChain.instance,chain:donorChain.chain,sourceChain:donorChain.sourceChain,residue:donor.index,resSeq:donor.resSeq,
     resName:donor.resName,sideChain:sideChainOf(structure,donor),
     key:moleculeResidueKey(structure.id,donorChain.instance,donorChain.sourceChain,donor)},
    acceptor:{instance:acceptorChain.instance,chain:acceptorChain.chain,sourceChain:acceptorChain.sourceChain,
     key:moleculeResidueKey(structure.id,acceptorChain.instance,acceptorChain.sourceChain,core[0]&&at(acceptorChain.chain,POCKET_CORE[0])!)},
    intermolecular:donorChain.instance!==acceptorChain.instance,
    relation:relationOf(byId.get(donorChain.instance)!,byId.get(acceptorChain.instance)!),
    pocket:[...core,...periphery],neighbours,
    secondary:pair&&thr4&&asp73?{donorResidue:thr4.index,acceptorResidue:asp73.index,donorLabel:label(thr4),acceptorLabel:label(asp73),
     minDistance:pair.distance,donorAtom:structure.atoms[pair.atoms[0]].name,acceptorAtom:structure.atoms[pair.atoms[1]].name,
     donorAtomIndex:pair.atoms[0],acceptorAtomIndex:pair.atoms[1]}:null,
    closest:Math.min(...neighbours.map(n=>n.minDistance)),
   });
  }
  if(!engaged)unengaged.push({instance:donorChain.instance,chain:donorChain.chain,sourceChain:donorChain.sourceChain,residue:donor.index});
 }
 return {contacts:contacts.sort((a,b)=>a.closest-b.closest||(a.donor.chain<b.donor.chain?-1:1)),unengaged};
}

/**
 * Chain-pair contacts between different molecule instances, split into contacts between the two biomolecules
 * (lateral, the two strands of the segment) and contacts between copies of one biomolecule (axial, along the repeat).
 * Measured with the shared interface criterion, so the βVal6 contact can be shown as one contact among several.
 */
function contactNetwork(structure:MultiChainStructure,chains:SickleChain[],instances:MoleculeInstance[],contacts:PathologicalContact[]):SickleModel['network']{
 const byChain=new Map(chains.map(c=>[c.chain,c])),assemblyOf=new Map(instances.map(i=>[i.id,i.assembly]));
 const pairKey=(a:string,b:string)=>JSON.stringify([a,b].sort());
 const mutationPairs=new Set(contacts.map(c=>pairKey(c.donor.chain,c.acceptor.chain)));
 const interfaces=interfaceContacts(structure).pairs
  .filter(p=>byChain.get(p.chains[0])!.instance!==byChain.get(p.chains[1])!.instance)
  .map(p=>{
   const [a,b]=p.chains.map(c=>byChain.get(c)!);
   return {chains:p.chains,instances:[a.instance,b.instance] as [string,string],sourceChains:[a.sourceChain,b.sourceChain] as [string,string],
    kind:(assemblyOf.get(a.instance)===assemblyOf.get(b.instance)?'axial':'lateral') as 'lateral'|'axial',
    involvesMutation:mutationPairs.has(pairKey(p.chains[0],p.chains[1])),
    residues:[p.residues[0].length,p.residues[1].length] as [number,number],atomPairs:p.atomPairs};
  }).sort((x,y)=>y.atomPairs-x.atomPairs);
 return {cutoff:INTERFACE_CUTOFF,lateral:interfaces.filter(i=>i.kind==='lateral').length,
  axial:interfaces.filter(i=>i.kind==='axial').length,involvingMutation:interfaces.filter(i=>i.involvesMutation).length,interfaces};
}

/**
 * Closest approach between atoms of *different* molecule instances. Atoms are bucketed per grid cell and per instance,
 * so only genuine cross-instance candidates are measured.
 */
function packingCheck(structure:MultiChainStructure,instanceOf:Map<string,string>,cutoff:number){
 const size=5,cells=new Map<string,Map<string,number[]>>();
 const cellOf=(p:Vec)=>[Math.floor(p[0]/size),Math.floor(p[1]/size),Math.floor(p[2]/size)];
 structure.atoms.forEach((a,i)=>{
  const key=cellOf(a.position).join(','),instance=instanceOf.get(a.chain)!;
  let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=new Map());
  const list=bucket.get(instance);if(list)list.push(i);else bucket.set(instance,[i]);
 });
 let closest=Infinity,overlaps=0;
 structure.atoms.forEach((a,i)=>{
  const own=instanceOf.get(a.chain)!,[x,y,z]=cellOf(a.position);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
   const bucket=cells.get(`${x+dx},${y+dy},${z+dz}`);if(!bucket)continue;
   for(const [instance,list] of bucket){
    if(instance===own)continue;
    for(const j of list){
     if(j<=i)continue;
     const d=Math.sqrt(d2(a.position,structure.atoms[j].position));
     if(d<closest)closest=d;
     if(d<cutoff)overlaps++;
    }
   }
  }
 });
 return {closest,overlapCutoff:cutoff,overlaps};
}

/**
 * Builds the short repeating segment: each REMARK 350 biomolecule of the deposited file, copied once per unit-cell
 * translation in `cells`. Every copy is a lattice translation (identity rotation) — an exact symmetry operation of any
 * space group — so no internal geometry can change and nothing is positioned by hand.
 */
function buildSegment(deposited:MultiChainStructure,header:PdbHeader,crystal:CrystalFrame,cells:[number,number,number][]){
 if(header.assemblies.length<2)fail(`expected at least two biological assemblies in the asymmetric unit, found ${header.assemblies.length}`);
 const isIdentity=(op:{rotation:number[][];translation:number[]})=>op.rotation.every((row,i)=>row.every((v,j)=>v===(i===j?1:0)))&&op.translation.every(v=>v===0);
 const assemblies=header.assemblies.map(a=>{
  if(a.operators.length!==1||!isIdentity(a.operators[0]))fail(`biomolecule ${a.id} is not a single identity operator`);
  return {id:a.id,chains:a.chains,identity:true};
 });
 const listed=assemblies.flatMap(a=>a.chains);
 if(new Set(listed).size!==listed.length)fail('a chain appears in more than one biomolecule');
 if([...listed].sort().join(',')!==[...deposited.chains].sort().join(','))fail('the biomolecules do not cover exactly the deposited polymer chains');
 const instances:MoleculeInstance[]=[],copies:StructureCopy[]=[];
 for(const c of cells)for(const a of assemblies){
  const id=instanceId(a.id,c),transform=latticeTransform(crystal,c);
  instances.push({id,label:instanceLabel(a.id,c),assembly:a.id,cells:c,operation:latticeLabel(c),sourceChains:a.chains,
   chains:a.chains.map(s=>`${id}/${s}`),transform,deposited:c.every(v=>v===0)});
  copies.push({id,chains:a.chains,transform,chainId:(source:string)=>`${id}/${source}`});
 }
 return {instances,assemblies,...buildCopies(deposited,copies)};
}

/** Cα of one chain, keyed by residue number; both files use mature-globin numbering (checked in `globinTypes`). */
const caByPosition=(structure:MultiChainStructure,chain:string)=>{
 const map=new Map<number,{residue:PdbResidue;atom:number}>();
 for(const r of structure.residues)if(r.chain===chain&&r.insertionCode===''){
  const ca=r.atoms.find(i=>structure.atoms[i].name==='CA');
  if(ca!==undefined)map.set(r.resSeq,{residue:r,atom:ca});
 }
 return map;
};
/** Rigid Cα superposition of one chain onto another, by matched residue number. */
function alignChains(from:MultiChainStructure,fromChain:string,to:MultiChainStructure,toChain:string){
 const a=caByPosition(from,fromChain),b=caByPosition(to,toChain);
 const positions=[...a.keys()].filter(k=>b.has(k)).sort((x,y)=>x-y);
 if(positions.length<3)fail(`chains ${fromChain} / ${toChain} share fewer than 3 Cα`);
 const fit=fitRigid(positions.map(k=>from.atoms[a.get(k)!.atom].position),positions.map(k=>to.atoms[b.get(k)!.atom].position));
 return {...fit,matched:positions.length,
  differences:positions.filter(k=>a.get(k)!.residue.resName!==b.get(k)!.residue.resName)
   .map(k=>({position:k,hba:a.get(k)!.residue.resName,hbs:b.get(k)!.residue.resName}))};
}

/**
 * HbA ↔ HbS comparison of the β chain that donates βVal6 in the pathological contact. The HbA β chain is superposed
 * onto it by its own matched Cα (one rigid rotation + translation), so both are seen in the same frame around β6.
 * The orientation difference between two separate crystal structures is therefore never shown as an effect of the mutation.
 */
function compareMutation(hbs:MultiChainStructure,donorChain:SickleChain,hbaModel:HemoglobinModel,hbaBeta:string,
 chains:SickleChain[],instances:MoleculeInstance[]):MutationComparison{
 const hba=hbaModel.structure,fit=alignChains(hba,hbaBeta,hbs,donorChain.chain);
 const hbaPositions=hba.atoms.map(a=>applyRigid(fit,a.position));
 const siteOf=(s:MultiChainStructure,chain:string,expect:string,instance:string|null,sourceChain:string):MutationSite=>{
  const r=s.residues.find(x=>x.chain===chain&&x.resSeq===MUTATION_POSITION&&x.insertionCode==='');
  if(!r)fail(`${s.id} chain ${chain} has no residue ${MUTATION_POSITION}`);
  if(r.resName!==expect)fail(`${s.id} chain ${chain} residue ${MUTATION_POSITION} is ${r.resName}, not ${expect}`);
  const ca=r.atoms.find(i=>s.atoms[i].name==='CA');
  if(ca===undefined)fail(`${s.id} ${chain}${MUTATION_POSITION} has no Cα`);
  return {structure:s.id,instance,chain,sourceChain,position:MUTATION_POSITION,resName:r.resName,chemical:classOf(r.resName),
   residue:r.index,sideChain:sideChainOf(s,r),caAtom:ca,key:moleculeResidueKey(s.id,instance??'deposited',sourceChain,r)};
 };
 const hbaSite=siteOf(hba,hbaBeta,HBA_MUTATION_RESIDUE,null,hbaBeta);
 const hbsSite=siteOf(hbs,donorChain.chain,HBS_MUTATION_RESIDUE,donorChain.instance,donorChain.sourceChain);
 const near=(s:MultiChainStructure,chain:string,site:MutationSite)=>{
  const probe=site.sideChain.length?site.sideChain:[site.caAtom];
  return s.residues.filter(r=>r.chain===chain&&r.atoms.some(i=>probe.some(j=>d2(s.atoms[i].position,s.atoms[j].position)<=NEIGHBOURHOOD_RADIUS**2))).map(r=>r.index);
 };
 // Sanity check that one surface substitution has not refolded the protein: each chain and each tetramer fitted on its
 // own, matching HbS subunits to HbA subunits by educational label (α1↔α1, β1↔β1, …), never by chain letter.
 const reference=new Map<SubunitLabel,string>(hbaModel.subunits.map(s=>[s.label,s.chain]));
 const deposited=chains.filter(c=>instances.find(i=>i.id===c.instance)!.deposited);
 const chainFits=deposited.map((c):ChainFit=>{
  const ref=reference.get(c.label)!,f=alignChains(hbs,c.chain,hba,ref);
  return {chain:c.chain,instance:c.instance,sourceChain:c.sourceChain,type:c.type,label:c.label,reference:ref,matched:f.matched,rmsd:f.rmsd};
 });
 const tetramerFits=instances.filter(i=>i.deposited).map(instance=>{
  const from:Vec[]=[],to:Vec[]=[];
  for(const label of SUBUNIT_ORDER){
   const c=deposited.find(c=>c.instance===instance.id&&c.label===label)!;
   const a=caByPosition(hbs,c.chain),b=caByPosition(hba,reference.get(label)!);
   for(const k of [...a.keys()].filter(k=>b.has(k)).sort((x,y)=>x-y)){from.push(hbs.atoms[a.get(k)!.atom].position);to.push(hba.atoms[b.get(k)!.atom].position);}
  }
  return {instance:instance.id,matched:from.length,rmsd:fitRigid(from,to).rmsd};
 });
 return {hba:hbaSite,hbs:hbsSite,
  alignment:{matched:fit.matched,rmsd:fit.rmsd,maxDeviation:fit.maxDeviation,determinant:determinant(fit.rotation),
   transform:{rotation:fit.rotation,translation:fit.translation}},
  differences:fit.differences,hbaPositions,
  hbaChainResidues:hba.residues.filter(r=>r.chain===hbaBeta).map(r=>r.index),
  hbsChainResidues:hbs.residues.filter(r=>r.chain===donorChain.chain).map(r=>r.index),
  neighbourhood:{radius:NEIGHBOURHOOD_RADIUS,hba:near(hba,hbaBeta,hbaSite),hbs:near(hbs,donorChain.chain,hbsSite)},
  chainFits,tetramerFits};
}

/**
 * Full HbA → HbS → polymerization analysis, from the two deposited files only.
 *
 * HbS (2HBS): both REMARK 350 biomolecules are read as two independent α2βS2 tetramers ("Molecule 1" / "Molecule 2"),
 * and the segment adds one copy of each per unit-cell translation in `cells`. Chain types come from each chain's own
 * UniProt DBREF; β6 is checked to be Val in every βS chain. The βVal6 → βAla70/βPhe85/βLeu88 contacts are then found
 * from the coordinates, with donor and acceptor required to be different molecule instances.
 */
export function analyzeSickle(hbsText:string,hbaText:string,cells:[number,number,number][]=SEGMENT_CELLS):SickleModel{
 const deposited=parseMultiChainPdb(hbsText),header=parsePdbHeader(hbsText),crystal=parseCrystalFrame(hbsText);
 // The HbA reference goes through the Phase 4A analysis unchanged: assembly, DBREF chain types, SEQRES, hemes and α1β1 labels.
 const hbaModel=analyzeHemoglobin(hbaText),hba=hbaModel.structure;
 const types=globinTypes(header,deposited.chains,HBS_SOURCE.pdbId);
 const betas=deposited.chains.filter(c=>types.get(c)!.type==='beta');
 if(deposited.chains.filter(c=>types.get(c)!.type==='alpha').length!==betas.length)fail('α and β chain counts differ');
 // Every β chain must carry the sickle substitution: an HbS tetramer has two βS chains, not one.
 for(const chain of betas){
  const seq=header.seqres.get(chain);
  if(!seq)fail(`chain ${chain} has no SEQRES`);
  if(seq[MUTATION_POSITION-1]!==HBS_MUTATION_RESIDUE)fail(`chain ${chain} SEQRES position ${MUTATION_POSITION} is ${seq[MUTATION_POSITION-1]}, not ${HBS_MUTATION_RESIDUE}`);
 }
 const unexpected=deposited.hetero.filter(g=>g.resName!=='HEM');
 if(unexpected.length)fail(`unexpected hetero groups ${[...new Set(unexpected.map(g=>g.resName))].join(', ')}`);
 // Heme → chain from the coordinates on the deposited unit only; buildCopies then carries each heme with its chain.
 const hemeOf=new Map<string,number>();
 for(const g of deposited.hetero.filter(g=>g.resName==='HEM')){
  const chain=associateHetero(deposited,g).chain;
  if(hemeOf.has(chain))fail(`chain ${chain} is associated with more than one heme`);
  if(chain!==g.chain)fail(`heme ${g.resName} ${g.chain}${g.resSeq} is surrounded by chain ${chain}, not its record chain`);
  hemeOf.set(chain,g.index);
 }
 for(const chain of deposited.chains)if(!hemeOf.has(chain))fail(`chain ${chain} has no associated heme`);
 const {instances,assemblies,structure,chains:copied}=buildSegment(deposited,header,crystal,cells);
 // Subunit labels come from the deposited coordinates (one interface analysis of the asymmetric unit), then travel with every copy.
 const depositedInterfaces=interfaceContacts(deposited);
 const labels=new Map<string,SubunitLabel>();
 for(const a of assemblies)for(const [chain,label] of Object.entries(labelTetramer(depositedInterfaces,
  a.chains.filter(c=>types.get(c)!.type==='alpha'),a.chains.filter(c=>types.get(c)!.type==='beta'))))labels.set(chain,label);
 const instanceOf=new Map(copied.map(c=>[c.chain,c.copy]));
 const chains:SickleChain[]=copied.map(c=>{
  const t=types.get(c.source)!,heme=structure.hetero.find(g=>g.resName==='HEM'&&g.chain===c.chain);
  if(!heme)fail(`chain ${c.chain} lost its heme in the segment`);
  const iron=heme.atoms.find(i=>structure.atoms[i].element==='FE');
  if(iron===undefined)fail(`heme of chain ${c.chain} has no Fe`);
  return {chain:c.chain,instance:c.copy,sourceChain:c.source,type:t.type,uniprot:t.uniprot,entry:t.entry,label:labels.get(c.source)!,
   residues:structure.residues.filter(r=>r.chain===c.chain).map(r=>r.index),heme:heme.index,iron};
 });
 const {contacts,unengaged}=findContacts(structure,chains,instances,CONTACT_CUTOFF);
 if(!contacts.length)fail('no βVal6 → β-chain pocket contact found in the segment');
 const withinUnit=new Set(instances.filter(i=>i.deposited).map(i=>i.id));
 const primary=contacts.find(c=>withinUnit.has(c.donor.instance)&&withinUnit.has(c.acceptor.instance));
 if(!primary)fail('no βVal6 pocket contact inside the deposited asymmetric unit');
 if(!primary.intermolecular)fail('the primary contact is not between two different molecule instances');
 const donorChain=chains.find(c=>c.chain===primary.donor.chain)!;
 // The HbA β chain compared with the donor βS chain is the one carrying the same educational label.
 const hbaBeta=hbaModel.subunits.find(s=>s.label===donorChain.label)?.chain??hbaModel.subunits.find(s=>s.type==='beta')?.chain;
 if(!hbaBeta)fail('the HbA reference has no β chain');
 const bonds=inferBonds(structure);
 // Inferred bonds must never cross molecules: an intermolecular contact is proximity, not a chemical bond.
 for(const [a,b] of bonds)if(instanceOf.get(structure.atoms[a].chain)!==instanceOf.get(structure.atoms[b].chain))
  fail('a covalent bond was inferred between two molecule instances');
 return {
  hbs:{instances,structure,header,crystal,chains,bonds,
   hemeBonds:inferBonds({atoms:structure.atoms,residues:structure.hetero.filter(g=>g.resName==='HEM')}),
   assemblies,omitted:deposited.omitted},
  hba:{...hbaModel,betaChain:hbaBeta},
  mutation:compareMutation(structure,donorChain,hbaModel,hbaBeta,chains,instances),
  contacts,primary,
  // Only the deposited unit is reported: a donor at the edge of a finite segment has no partner simply because the segment ends.
  unengagedDonors:unengaged.filter(u=>withinUnit.has(u.instance)),
  packing:packingCheck(structure,instanceOf,OVERLAP_CUTOFF),
  network:contactNetwork(structure,chains,instances,contacts),
 };
}

export const residueLabel=(r:{resName:string;resSeq:number})=>`${r.resName[0]}${r.resName.slice(1).toLowerCase()}${r.resSeq}`;
/** Centroid of one molecule instance's polymer atoms. */
export const instanceCentroid=(m:SickleModel,id:string):Vec=>
 centroid(m.hbs.structure.atoms,m.hbs.chains.filter(c=>c.instance===id).flatMap(c=>c.residues).flatMap(i=>m.hbs.structure.residues[i].atoms));

/** One drawable structure for the scene: atoms, residues and atom-index lists, with no analysis types attached. */
export type SickleLayer={
 id:string;atoms:PdbAtom[];positions:Vec[];residues:PdbResidue[];
 /** Residue index → side-chain chemical class, for the chemistry colouring. */ chemical:Record<number,ChemicalClass>;
 bonds:[number,number][];
};
export type SceneChain={chain:string;instance:string;sourceChain:string;label:SubunitLabel;type:GlobinType;residues:number[]};
export type SceneInstance={id:string;label:string;assembly:number;cells:[number,number,number];operation:string;deposited:boolean;centroid:Vec};
/** A measured distance drawn as a dashed guide — a proximity marker, never a chemical bond. */
export type ContactGuide={a:number;b:number;distance:number;kind:'core'|'peripheral'|'secondary'};
export type SickleSceneModel={
 hbs:SickleLayer&{
  chains:SceneChain[];instances:SceneInstance[];
  hemes:{chain:string;instance:string;group:number;atoms:number[];iron:number}[];hemeBonds:[number,number][];
 };
 /** HbA β chain in the HbS frame (rigid superposition); the deposited file is never modified. */
 hba:SickleLayer&{chain:string;label:string};
 mutation:{
  hba:{residue:number;sideChain:number[];ca:number;neighbourhood:number[]};
  hbs:{residue:number;sideChain:number[];ca:number;neighbourhood:number[];instance:string};
 };
 contact:{
  donorInstance:string;acceptorInstance:string;
  donorResidue:number;donorSideChain:number[];
  /** Pocket residues in the acceptor molecule, core first. */ pocket:{residue:number;role:'core'|'peripheral';sideChain:number[]}[];
  guides:ContactGuide[];
 };
 /** Donor Val6 → acceptor pocket links at every junction of the segment, for the polymer view. */
 segmentContacts:{donorInstance:string;acceptorInstance:string;donorResidue:number;acceptorResidues:number[];a:number;b:number;distance:number}[];
};

/** Scene input derived from the analysis: coordinates, draw lists and the measured contact guides. */
export function sickleSceneModel(m:SickleModel):SickleSceneModel{
 const s=m.hbs.structure,hba=m.hba.structure;
 const chemicalOf=(structure:MultiChainStructure)=>Object.fromEntries(structure.residues.map(r=>[r.index,classOf(r.resName)])) as Record<number,ChemicalClass>;
 const sideOf=(structure:MultiChainStructure,index:number)=>sideChainOf(structure,structure.residues[index]);
 const p=m.primary;
 const guides:ContactGuide[]=p.pocket.map(q=>({a:q.donorAtomIndex,b:q.acceptorAtomIndex,distance:q.minDistance,kind:q.role==='core'?'core':'peripheral'} as ContactGuide));
 if(p.secondary)guides.push({a:p.secondary.donorAtomIndex,b:p.secondary.acceptorAtomIndex,distance:p.secondary.minDistance,kind:'secondary'});
 return {
  hbs:{id:s.id,atoms:s.atoms,positions:s.atoms.map(a=>a.position),residues:s.residues,chemical:chemicalOf(s),bonds:m.hbs.bonds,
   chains:m.hbs.chains.map(c=>({chain:c.chain,instance:c.instance,sourceChain:c.sourceChain,label:c.label,type:c.type,residues:c.residues})),
   instances:m.hbs.instances.map(i=>({id:i.id,label:i.label,assembly:i.assembly,cells:i.cells,operation:i.operation,deposited:i.deposited,centroid:instanceCentroid(m,i.id)})),
   hemes:m.hbs.chains.map(c=>({chain:c.chain,instance:c.instance,group:c.heme,atoms:s.hetero.find(g=>g.index===c.heme)!.atoms,iron:c.iron})),
   hemeBonds:m.hbs.hemeBonds},
  hba:{id:hba.id,atoms:hba.atoms,positions:m.mutation.hbaPositions,residues:hba.residues,chemical:chemicalOf(hba),bonds:m.hba.bonds,
   chain:m.hba.betaChain,label:m.hba.subunits.find(x=>x.chain===m.hba.betaChain)!.label},
  mutation:{
   hba:{residue:m.mutation.hba.residue,sideChain:m.mutation.hba.sideChain,ca:m.mutation.hba.caAtom,neighbourhood:m.mutation.neighbourhood.hba},
   hbs:{residue:m.mutation.hbs.residue,sideChain:m.mutation.hbs.sideChain,ca:m.mutation.hbs.caAtom,neighbourhood:m.mutation.neighbourhood.hbs,instance:m.mutation.hbs.instance!},
  },
  contact:{donorInstance:p.donor.instance,acceptorInstance:p.acceptor.instance,donorResidue:p.donor.residue,donorSideChain:p.donor.sideChain,
   pocket:p.pocket.map(q=>({residue:q.residue,role:q.role==='core'?'core':'peripheral',sideChain:sideOf(s,q.residue)})),guides},
  segmentContacts:m.contacts.map(c=>{
   const nearest=c.neighbours[0];
   return {donorInstance:c.donor.instance,acceptorInstance:c.acceptor.instance,donorResidue:c.donor.residue,
    acceptorResidues:c.pocket.filter(q=>q.role==='core').map(q=>q.residue),a:nearest.donorAtomIndex,b:nearest.acceptorAtomIndex,distance:nearest.minDistance};
  }),
 };
}
