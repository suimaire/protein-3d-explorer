import type {Vec} from '../geometry/vector';

export type PdbAtom={serial:number;name:string;element:string;resName:string;resSeq:number;chain:string;altLoc:string;occupancy:number;bFactor:number;position:Vec};
export type SecondaryStructure='helix'|'helix310'|'strand'|'other';
export type PdbResidue={index:number;resName:string;resSeq:number;chain:string;atoms:number[];occupancy:number;secondary:SecondaryStructure};
export type ProteinStructure={id:string;chain:string;atoms:PdbAtom[];residues:PdbResidue[];omitted:{waters:number;hetero:number;hydrogens:number;otherChains:number;alternateLocations:number}};

const column=(line:string,start:number,end:number)=>line.slice(start-1,end).trim();

/**
 * Fixed-column PDB parser for one protein chain of the first model.
 * Policy: ATOM records only; HETATM (water/ligand), H/D and other chains are counted and omitted.
 * Alternate locations: keep the highest occupancy per atom name (first listed on ties).
 * Coordinates are used exactly as deposited.
 */
export function parsePdb(text:string,chain='A'):ProteinStructure{
 const lines=text.split(/\r?\n/),id=column(lines[0]??'',63,66);
 const omitted={waters:0,hetero:0,hydrogens:0,otherChains:0,alternateLocations:0};
 const kept=new Map<string,PdbAtom>(),helix:[number,number,SecondaryStructure][]=[],strand:[number,number][]=[];
 let modelCount=0;
 for(const line of lines){
  const record=column(line,1,6);
  if(record==='MODEL'){modelCount++;continue;}
  if(record==='ENDMDL'&&modelCount>=1)break;
  if(record==='HELIX'&&column(line,20,20)===chain)helix.push([Number(column(line,22,25)),Number(column(line,34,37)),Number(column(line,39,40))===5?'helix310':'helix']);
  if(record==='SHEET'&&column(line,22,22)===chain)strand.push([Number(column(line,23,26)),Number(column(line,34,37))]);
  if(record==='HETATM'){if(['HOH','DOD'].includes(column(line,18,20)))omitted.waters++;else omitted.hetero++;continue;}
  if(record!=='ATOM')continue;
  if(column(line,22,22)!==chain){omitted.otherChains++;continue;}
  const name=column(line,13,16),element=(column(line,77,78)||name.replace(/[^A-Z]/g,'')[0]).toUpperCase();
  if(element==='H'||element==='D'){omitted.hydrogens++;continue;}
  const atom:PdbAtom={serial:Number(column(line,7,11)),name,element,resName:column(line,18,20),resSeq:Number(column(line,23,26)),chain,altLoc:column(line,17,17),occupancy:Number(column(line,55,60)),bFactor:Number(column(line,61,66)),position:[Number(column(line,31,38)),Number(column(line,39,46)),Number(column(line,47,54))]};
  const key=`${atom.resSeq}${column(line,27,27)}:${name}`,previous=kept.get(key);
  if(previous){omitted.alternateLocations++;if(atom.occupancy>previous.occupancy)kept.set(key,atom);}else kept.set(key,atom);
 }
 const atoms=[...kept.values()],residues:PdbResidue[]=[];
 atoms.forEach((atom,i)=>{
  let residue=residues.at(-1);
  if(!residue||residue.resSeq!==atom.resSeq){residue={index:residues.length,resName:atom.resName,resSeq:atom.resSeq,chain,atoms:[],occupancy:atom.occupancy,secondary:'other'};residues.push(residue);}
  residue.atoms.push(i);residue.occupancy=Math.min(residue.occupancy,atom.occupancy);
 });
 for(const r of residues){
  const h=helix.find(([a,b])=>r.resSeq>=a&&r.resSeq<=b);
  if(h)r.secondary=h[2];else if(strand.some(([a,b])=>r.resSeq>=a&&r.resSeq<=b))r.secondary='strand';
 }
 return {id,chain,atoms,residues,omitted};
}

export const BACKBONE_NAMES=new Set(['N','CA','C','O','OXT']);
export const isSideChainAtom=(atom:PdbAtom)=>!BACKBONE_NAMES.has(atom.name);
