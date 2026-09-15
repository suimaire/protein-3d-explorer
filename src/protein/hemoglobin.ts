import type {Vec} from '../geometry/vector';
import type {AssemblySceneModel} from '../rendering/AssemblyScene';
import {inferBonds} from './exposure';
import {parseMultiChainPdb,parsePdbHeader,residueKey,type MultiChainStructure,type PdbHeader} from './pdb';
import {associateHetero,explodedOffsets,interfaceContacts,nearestPolymerLigand,pairBetween,type HeteroAssociation,type InterfaceAnalysis,type MetalLigand} from './quaternary';

/** RCSB entry 2DN2 (Park, Yokoyama, Shibayama, Shiro & Tame 2006), human deoxyhemoglobin A, X-ray diffraction. */
export const HEMOGLOBIN_SOURCE={pdbId:'2DN2',protein:'Hemoglobin A (adult human)',organism:'Homo sapiens',method:'X-ray diffraction',resolution:1.25,
 state:'deoxy (no O₂ ligand)',doi:'10.1016/j.jmb.2006.05.036',citation:'Park et al. (2006) J. Mol. Biol. 360:690–701',sha256:'cc2fca4182e61cb85c2b0082c80167eb7d189a84b148faaa6eb810977c64e214'} as const;

export type GlobinType='alpha'|'beta';
/**
 * Globin type from the reference sequence the depositors cross-referenced (DBREF → UniProt), not from chain letters.
 * Only these two accessions are accepted; any other chain makes the analysis fail loudly.
 */
export const GLOBIN_BY_UNIPROT:Record<string,{type:GlobinType;entry:string}>={
 P69905:{type:'alpha',entry:'HBA_HUMAN'},
 P68871:{type:'beta',entry:'HBB_HUMAN'},
};
export const GLOBIN_INFO:Record<GlobinType,{symbol:string;name:string}>={alpha:{symbol:'α',name:'α-globin'},beta:{symbol:'β',name:'β-globin'}};

export type SubunitLabel='α1'|'β1'|'α2'|'β2';
export const SUBUNIT_ORDER:SubunitLabel[]=['α1','β1','α2','β2'];
/** By subunit: four distinct hues. By chain type: one hue per globin type. Heme keeps its own colors in every mode. */
export const SUBUNIT_COLORS:Record<SubunitLabel,{color:number;css:string}>={
 'α1':{color:0x3567c4,css:'#3567c4'},'β1':{color:0x3c9a55,css:'#3c9a55'},'α2':{color:0x8a5ac2,css:'#8a5ac2'},'β2':{color:0xc68416,css:'#c68416'},
};
export const TYPE_COLORS:Record<GlobinType,{color:number;css:string}>={alpha:{color:0x3f73c9,css:'#3f73c9'},beta:{color:0x3a9a58,css:'#3a9a58'}};
export const HEME_COLORS={carbon:0xc22f3c,css:'#c22f3c',iron:0xf08a1c,ironCss:'#f08a1c'} as const;

export type HemeSite={
 /** 1…4 in subunit order (α1, β1, α2, β2). */ number:number;
 group:number;resName:string;resSeq:number;fileChain:string;atomCount:number;
 iron:number;association:HeteroAssociation;
 /** Nearest polymer N/O/S to Fe, measured. */ proximal:MetalLigand&{resName:string;resSeq:number;atomName:string;chain:string};
};
export type Subunit={
 label:SubunitLabel;chain:string;type:GlobinType;uniprot:string;entry:string;molecule:string;
 /** SEQRES length (deposited sequence). */ sequenceLength:number;
 /** Residues with coordinates. */ modeledResidues:number;
 firstResSeq:number;lastResSeq:number;residues:number[];heme:HemeSite;
};
export type HemoglobinModel={
 structure:MultiChainStructure;header:PdbHeader;bonds:[number,number][];hemeBonds:[number,number][];
 subunits:Subunit[];hemes:HemeSite[];interfaces:InterfaceAnalysis;
 assembly:{id:number;author:string;software:string;chains:string[];identity:boolean};
 /** Chain → display offset for the explanatory exploded view. */ exploded:Record<string,Vec>;
 /** Hetero group index → owning chain (spatial association). */ hetero:Record<number,string>;
};
export const EXPLODED_DISTANCE=8;

const same=(a:string[],b:string[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const isIdentity=(op:{rotation:number[][];translation:number[]})=>op.rotation.every((row,i)=>row.every((v,j)=>v===(i===j?1:0)))&&op.translation.every(v=>v===0);
function fail(message:string):never{throw new Error(`Hemoglobin validation: ${message}`);}

/**
 * Builds the teaching model from the deposited file and verifies every claim the module makes:
 * one biological assembly = the deposited chains under the identity operator; two α and two β chains by DBREF
 * accession with identical SEQRES within each type; one heme per chain by spatial association; Fe with a measured
 * polymer ligand. Labels: α1 = first α chain in the file; β1 = the β chain with the larger α1 contact (the α1β1
 * packing interface); α2 and β2 = the remaining chains.
 */
export function analyzeHemoglobin(text:string):HemoglobinModel{
 const structure=parseMultiChainPdb(text),header=parsePdbHeader(text);
 if(header.assemblies.length!==1)fail(`expected one biological assembly, found ${header.assemblies.length}`);
 const bio=header.assemblies[0],identity=bio.operators.length===1&&isIdentity(bio.operators[0]);
 if(!identity||!same([...bio.chains].sort(),[...structure.chains].sort()))fail('assembly is not the deposited chains under the identity operator');
 const types=new Map<string,{type:GlobinType;uniprot:string;entry:string}>();
 for(const chain of structure.chains){
  const refs=header.dbref.filter(d=>d.chain===chain&&d.database==='UNP');
  if(refs.length!==1)fail(`chain ${chain} needs exactly one UniProt DBREF`);
  const globin=GLOBIN_BY_UNIPROT[refs[0].accession];
  if(!globin||globin.entry!==refs[0].idCode)fail(`chain ${chain} is ${refs[0].accession} ${refs[0].idCode}, not a human α/β globin`);
  types.set(chain,{type:globin.type,uniprot:refs[0].accession,entry:refs[0].idCode});
 }
 const chainsOf=(t:GlobinType)=>structure.chains.filter(c=>types.get(c)!.type===t),alphas=chainsOf('alpha'),betas=chainsOf('beta');
 if(alphas.length!==2||betas.length!==2)fail(`expected α2β2, found α${alphas.length}β${betas.length}`);
 for(const group of [alphas,betas])if(!same(header.seqres.get(group[0])!,header.seqres.get(group[1])!))fail(`chains ${group.join('/')} differ in sequence`);
 if(same(header.seqres.get(alphas[0])!,header.seqres.get(betas[0])!))fail('α and β sequences are identical');
 for(const chain of structure.chains){
  const modeled=structure.residues.filter(r=>r.chain===chain).map(r=>r.resName),seq=header.seqres.get(chain)!;
  if(modeled.some((name,i)=>seq[i]!==name)&&header.missingResidues===0)fail(`chain ${chain} modeled residues do not follow SEQRES`);
 }
 const interfaces=interfaceContacts(structure);
 const contactSize=(a:string,b:string)=>{const p=pairBetween(interfaces,a,b);return p?p.residues[0].length+p.residues[1].length:0;};
 const alpha1=alphas[0],alpha2=alphas[1],beta1=[...betas].sort((a,b)=>contactSize(alpha1,b)-contactSize(alpha1,a))[0],beta2=betas.find(c=>c!==beta1)!;
 if(contactSize(alpha1,beta1)===contactSize(alpha1,beta2))fail('α1 contacts both β chains equally; α1β1 is ambiguous');
 const labelOf:Record<string,SubunitLabel>={[alpha1]:'α1',[beta1]:'β1',[alpha2]:'α2',[beta2]:'β2'};

 const hemeGroups=structure.hetero.filter(g=>g.resName==='HEM');
 const unexpected=structure.hetero.filter(g=>g.resName!=='HEM');
 if(unexpected.length)fail(`unexpected hetero groups ${unexpected.map(residueKey).join(', ')}`);
 const hemeSites=hemeGroups.map(group=>{
  const irons=group.atoms.filter(i=>structure.atoms[i].element==='FE');
  if(irons.length!==1)fail(`${residueKey(group)} has ${irons.length} Fe atoms`);
  const association=associateHetero(structure,group),ligand=nearestPolymerLigand(structure,irons[0]),res=structure.residues[ligand.residue],atom=structure.atoms[ligand.atom];
  return {group:group.index,resName:group.resName,resSeq:group.resSeq,fileChain:group.chain,atomCount:group.atoms.length,iron:irons[0],association,
   proximal:{...ligand,resName:res.resName,resSeq:res.resSeq,atomName:atom.name,chain:res.chain},number:0};
 });
 for(const chain of structure.chains){const n=hemeSites.filter(h=>h.association.chain===chain).length;if(n!==1)fail(`chain ${chain} is associated with ${n} hemes`);}
 const subunits=structure.chains.map(chain=>{
  const residues=structure.residues.filter(r=>r.chain===chain),t=types.get(chain)!,heme=hemeSites.find(h=>h.association.chain===chain)!;
  return {label:labelOf[chain],chain,type:t.type,uniprot:t.uniprot,entry:t.entry,molecule:header.molecules.find(m=>m.chains.includes(chain))?.name??'',
   sequenceLength:header.seqres.get(chain)!.length,modeledResidues:residues.length,firstResSeq:residues[0].resSeq,lastResSeq:residues.at(-1)!.resSeq,residues:residues.map(r=>r.index),heme} satisfies Subunit;
 }).sort((a,b)=>SUBUNIT_ORDER.indexOf(a.label)-SUBUNIT_ORDER.indexOf(b.label));
 subunits.forEach((s,i)=>{s.heme.number=i+1;});
 const hemes=subunits.map(s=>s.heme);
 return {structure,header,bonds:inferBonds(structure),hemeBonds:inferBonds({atoms:structure.atoms,residues:structure.hetero}),subunits,hemes,interfaces,
  assembly:{id:bio.id,author:bio.author,software:bio.software,chains:bio.chains,identity},exploded:explodedOffsets(structure,EXPLODED_DISTANCE),
  hetero:Object.fromEntries(hemes.map(h=>[h.group,h.association.chain]))};
}

export const residueLabel=(r:{resName:string;resSeq:number;insertionCode:string})=>`${r.resName[0]}${r.resName.slice(1).toLowerCase()} ${r.resSeq}${r.insertionCode}`;

/** Scene input: PDB chain → educational label and colors; heme → spatially associated chain, Fe and proximal ligand. */
export const hemoglobinSceneModel=(m:HemoglobinModel):AssemblySceneModel=>({
 structure:m.structure,bonds:m.bonds,hemeBonds:m.hemeBonds,exploded:m.exploded,
 chains:m.subunits.map(s=>({chain:s.chain,label:s.label,color:SUBUNIT_COLORS[s.label].color,typeColor:TYPE_COLORS[s.type].color})),
 hemes:m.hemes.map(h=>({group:h.group,chain:h.association.chain,iron:h.iron,number:h.number,proximal:{residue:h.proximal.residue,atom:h.proximal.atom}})),
});

