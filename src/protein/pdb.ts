import type {Vec} from '../geometry/vector';

export type PdbAtom={serial:number;name:string;element:string;resName:string;resSeq:number;insertionCode:string;chain:string;altLoc:string;occupancy:number;bFactor:number;position:Vec;hetero:boolean};
export type SecondaryStructure='helix'|'helix310'|'strand'|'other';
export type PdbResidue={index:number;resName:string;resSeq:number;insertionCode:string;chain:string;atoms:number[];occupancy:number;secondary:SecondaryStructure};
export type ProteinStructure={id:string;chain:string;atoms:PdbAtom[];residues:PdbResidue[];omitted:{waters:number;hetero:number;hydrogens:number;otherChains:number;alternateLocations:number}};

const column=(line:string,start:number,end:number)=>line.slice(start-1,end).trim();
const WATER=new Set(['HOH','DOD','WAT']);

/**
 * Residue identity for any number of chains: chain ID + residue number + insertion code + residue name.
 * resSeq alone is not unique once a structure has more than one chain (A 10 ≠ B 10) or insertion codes (10 ≠ 10A).
 */
export const residueKey=(r:{chain:string;resSeq:number;insertionCode:string;resName:string})=>`${r.chain}:${r.resSeq}${r.insertionCode}:${r.resName}`;
/** Identity of one atom position before alternate locations are resolved (altloc conformers share it). */
const atomSlotKey=(a:PdbAtom)=>`${a.chain}:${a.resSeq}${a.insertionCode}:${a.name}`;

function atomOf(line:string):PdbAtom{
 const name=column(line,13,16);
 return {serial:Number(column(line,7,11)),name,element:(column(line,77,78)||name.replace(/[^A-Z]/g,'')[0]).toUpperCase(),resName:column(line,18,20),resSeq:Number(column(line,23,26)),insertionCode:column(line,27,27),
  chain:column(line,22,22),altLoc:column(line,17,17),occupancy:Number(column(line,55,60)),bFactor:Number(column(line,61,66)),position:[Number(column(line,31,38)),Number(column(line,39,46)),Number(column(line,47,54))],hetero:column(line,1,6)==='HETATM'};
}
/**
 * Alternate locations: one conformer per atom slot (chain + resSeq + insertion code + atom name) — the highest
 * occupancy, the first listed on ties. Returns the number of discarded duplicate records.
 */
function keepAltloc(kept:Map<string,PdbAtom>,atom:PdbAtom){
 const key=atomSlotKey(atom),previous=kept.get(key);
 if(!previous){kept.set(key,atom);return 0;}
 if(atom.occupancy>previous.occupancy)kept.set(key,atom);
 return 1;
}
/** Consecutive atoms with the same residue identity form one residue (chain-aware; never resSeq alone). */
function groupResidues(atoms:PdbAtom[],offset=0,startIndex=0):PdbResidue[]{
 const residues:PdbResidue[]=[];let last='';
 atoms.forEach((atom,i)=>{
  const key=residueKey(atom);let residue=residues.at(-1);
  if(!residue||key!==last){residue={index:startIndex+residues.length,resName:atom.resName,resSeq:atom.resSeq,insertionCode:atom.insertionCode,chain:atom.chain,atoms:[],occupancy:atom.occupancy,secondary:'other'};residues.push(residue);last=key;}
  residue.atoms.push(offset+i);residue.occupancy=Math.min(residue.occupancy,atom.occupancy);
 });
 return residues;
}
type Range={chain:string;start:number;end:number;type:SecondaryStructure};
function secondaryRanges(lines:string[]):Range[]{
 const ranges:Range[]=[];
 for(const line of lines){
  const record=column(line,1,6);
  if(record==='HELIX')ranges.push({chain:column(line,20,20),start:Number(column(line,22,25)),end:Number(column(line,34,37)),type:Number(column(line,39,40))===5?'helix310':'helix'});
  if(record==='SHEET')ranges.push({chain:column(line,22,22),start:Number(column(line,23,26)),end:Number(column(line,34,37)),type:'strand'});
 }
 return ranges;
}
/** Deposited HELIX/SHEET records, matched by chain and residue number range. Helix records take precedence. */
function assignSecondary(residues:PdbResidue[],ranges:Range[]){
 for(const r of residues){
  const inside=(x:Range)=>x.chain===r.chain&&r.resSeq>=x.start&&r.resSeq<=x.end;
  const h=ranges.find(x=>x.type!=='strand'&&inside(x));
  if(h)r.secondary=h.type;else if(ranges.some(x=>x.type==='strand'&&inside(x)))r.secondary='strand';
 }
}
/** Lines of the first model only. */
function firstModel(text:string){
 const lines=text.split(/\r?\n/),out:string[]=[];let models=0;
 for(const line of lines){const record=column(line,1,6);if(record==='MODEL'){models++;continue;}if(record==='ENDMDL'&&models>=1)break;out.push(line);}
 return out;
}

/**
 * Fixed-column PDB parser for one protein chain of the first model.
 * Policy: ATOM records only; HETATM (water/ligand), H/D and other chains are counted and omitted.
 * Alternate locations: keep the highest occupancy per atom name (first listed on ties).
 * Coordinates are used exactly as deposited.
 */
export function parsePdb(text:string,chain='A'):ProteinStructure{
 const lines=firstModel(text),id=column(text.split(/\r?\n/,1)[0]??'',63,66);
 const omitted={waters:0,hetero:0,hydrogens:0,otherChains:0,alternateLocations:0};
 const kept=new Map<string,PdbAtom>();
 for(const line of lines){
  const record=column(line,1,6);
  if(record==='HETATM'){if(WATER.has(column(line,18,20)))omitted.waters++;else omitted.hetero++;continue;}
  if(record!=='ATOM')continue;
  if(column(line,22,22)!==chain){omitted.otherChains++;continue;}
  const atom=atomOf(line);
  if(atom.element==='H'||atom.element==='D'){omitted.hydrogens++;continue;}
  omitted.alternateLocations+=keepAltloc(kept,atom);
 }
 const atoms=[...kept.values()],residues=groupResidues(atoms);
 assignSecondary(residues,secondaryRanges(lines));
 return {id,chain,atoms,residues,omitted};
}

/** All chains of the first model: polymer residues (ATOM) and non-water hetero groups (HETATM) share one atom array. */
export type MultiChainStructure={
 id:string;
 /** Chain IDs in file order of their first ATOM record. */ chains:string[];
 atoms:PdbAtom[];
 /** Polymer residues (ATOM records), file order. */ residues:PdbResidue[];
 /** Hetero groups (HETATM, waters excluded), file order; `index` continues after the polymer residues. */ hetero:PdbResidue[];
 omitted:{waters:number;hydrogens:number;alternateLocations:number};
};

/**
 * General multi-chain reader (no structure-specific rules). Heavy atoms only; waters counted and omitted;
 * every other HETATM group is kept and reported, never silently dropped. Same altloc policy as `parsePdb`.
 */
export function parseMultiChainPdb(text:string):MultiChainStructure{
 const lines=firstModel(text),id=column(text.split(/\r?\n/,1)[0]??'',63,66);
 const omitted={waters:0,hydrogens:0,alternateLocations:0};
 const polymer=new Map<string,PdbAtom>(),hetero=new Map<string,PdbAtom>(),chains:string[]=[];
 for(const line of lines){
  const record=column(line,1,6);
  if(record!=='ATOM'&&record!=='HETATM')continue;
  if(record==='HETATM'&&WATER.has(column(line,18,20))){omitted.waters++;continue;}
  const atom=atomOf(line);
  if(atom.element==='H'||atom.element==='D'){omitted.hydrogens++;continue;}
  if(!atom.hetero&&!chains.includes(atom.chain))chains.push(atom.chain);
  omitted.alternateLocations+=keepAltloc(atom.hetero?hetero:polymer,atom);
 }
 const polymerAtoms=[...polymer.values()],heteroAtoms=[...hetero.values()];
 const residues=groupResidues(polymerAtoms);
 assignSecondary(residues,secondaryRanges(lines));
 return {id,chains,atoms:[...polymerAtoms,...heteroAtoms],residues,hetero:groupResidues(heteroAtoms,polymerAtoms.length,residues.length),omitted};
}

export type PdbHeader={
 /** DBREF: chain → reference database accession / entry name. */ dbref:{chain:string;database:string;accession:string;idCode:string}[];
 /** SEQRES: chain → deposited sequence (three-letter codes), including residues that may be unmodeled. */ seqres:Map<string,string[]>;
 /** COMPND: MOL_ID → molecule name and chain list. */ molecules:{molId:number;name:string;chains:string[]}[];
 /** REMARK 350 biomolecules: chains and BIOMT operators (rotation rows + translation). */ assemblies:{id:number;author:string;software:string;chains:string[];operators:{rotation:[Vec,Vec,Vec];translation:Vec}[]}[];
 /** REMARK 465 missing residues and REMARK 470 missing atoms (raw record counts). */ missingResidues:number;missingAtoms:number;
 /** LINK records between two atoms, with the deposited distance. */ links:{a:{name:string;resName:string;chain:string;resSeq:number};b:{name:string;resName:string;chain:string;resSeq:number};distance:number}[];
 resolution:number|null;method:string;
};

/** Header records used to verify assembly, entity and chain identity from the file itself. */
export function parsePdbHeader(text:string):PdbHeader{
 const lines=text.split(/\r?\n/),seqres=new Map<string,string[]>(),dbref:PdbHeader['dbref']=[],assemblies:PdbHeader['assemblies']=[],links:PdbHeader['links']=[];
 let compnd='',missingResidues=0,missingAtoms=0,resolution:number|null=null,method='';
 for(const line of lines){
  const record=column(line,1,6);
  if(record==='SEQRES'){const chain=column(line,12,12);seqres.set(chain,[...(seqres.get(chain)??[]),...column(line,20,70).split(/\s+/).filter(Boolean)]);}
  else if(record==='DBREF')dbref.push({chain:column(line,13,13),database:column(line,27,32),accession:column(line,34,41),idCode:column(line,43,54)});
  else if(record==='COMPND')compnd+=' '+column(line,11,80);
  else if(record==='EXPDTA')method=column(line,11,79);
  else if(record==='LINK'){const side=(o:number)=>({name:column(line,13+o,16+o),resName:column(line,18+o,20+o),chain:column(line,22+o,22+o),resSeq:Number(column(line,23+o,26+o))});links.push({a:side(0),b:side(30),distance:Number(column(line,74,78))});}
  else if(record==='REMARK'){
   const n=Number(column(line,8,10)),body=line.slice(11);
   if(n===2){const m=body.match(/RESOLUTION\.\s+([\d.]+)\s+ANGSTROMS/);if(m)resolution=Number(m[1]);}
   if(n===465&&/^\s+(?:\d+\s+)?[A-Z0-9]{1,3}\s+[A-Za-z0-9]\s+-?\d+[A-Z]?\s*$/.test(body))missingResidues++;
   if(n===470&&/^\s+(?:\d+\s+)?[A-Z0-9]{1,3}\s+[A-Za-z0-9]\s*-?\d+[A-Z]?\s+[A-Z0-9']+/.test(body))missingAtoms++;
   if(n===350){
    let m;
    if((m=body.match(/BIOMOLECULE:\s+(\d+)/)))assemblies.push({id:Number(m[1]),author:'',software:'',chains:[],operators:[]});
    const current=assemblies.at(-1);if(!current)continue;
    if((m=body.match(/AUTHOR DETERMINED BIOLOGICAL UNIT:\s+(\S+)/)))current.author=m[1];
    if((m=body.match(/SOFTWARE DETERMINED QUATERNARY STRUCTURE:\s+(\S+)/)))current.software=m[1];
    if((m=body.match(/(?:APPLY THE FOLLOWING TO CHAINS|AND CHAINS):\s+(.*)$/)))current.chains.push(...m[1].split(',').map(s=>s.trim()).filter(Boolean));
    if((m=body.match(/BIOMT(\d)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/))){
     const row=Number(m[1])-1,k=Number(m[2])-1;
     current.operators[k]??={rotation:[[0,0,0],[0,0,0],[0,0,0]],translation:[0,0,0]};
     current.operators[k].rotation[row]=[Number(m[3]),Number(m[4]),Number(m[5])];current.operators[k].translation[row]=Number(m[6]);
    }
   }
  }
 }
 const molecules:PdbHeader['molecules']=[];
 for(const part of compnd.split(/MOL_ID:/).slice(1)){
  const molId=Number(part.match(/^\s*(\d+)/)?.[1]),name=part.match(/MOLECULE:\s*([^;]+)/)?.[1].trim()??'',chains=(part.match(/CHAIN:\s*([^;]+)/)?.[1]??'').split(',').map(s=>s.trim()).filter(Boolean);
  molecules.push({molId,name,chains});
 }
 return {dbref,seqres,molecules,assemblies,missingResidues,missingAtoms,links,resolution,method};
}

export const BACKBONE_NAMES=new Set(['N','CA','C','O','OXT']);
export const isSideChainAtom=(atom:PdbAtom)=>!BACKBONE_NAMES.has(atom.name);
