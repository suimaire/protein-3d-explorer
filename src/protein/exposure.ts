import {distance} from '../geometry/vector';
import {CLASS_ORDER,MAX_ASA_TIEN_2013,classOf,type ChemicalClass} from './chemistry';
import {isSideChainAtom,type ProteinStructure} from './pdb';
import {shrakeRupley,SASA_POINTS,PROBE_RADIUS} from './sasa';

export type ResidueExposure={
 index:number;resName:string;resSeq:number;chemical:ChemicalClass;
 /** Whole-residue SASA, Å² (sum of its atom SASA). */ sasa:number;
 /** Side-chain SASA, Å² (atoms other than N, CA, C, O, OXT); 0 for Gly. */ sideChainSasa:number;
 /** Whole-residue SASA / Tien 2013 theoretical maximum. Not clamped; termini can exceed 1. */ relative:number;
 /** 1 = most buried in this structure; ties broken by residue number. */ rank:number;
 /** rank position as a fraction of this protein, 0 (most buried) … 1 (most exposed). */ percentile:number;
};
export type ExposureAnalysis={atomSasa:number[];residues:ResidueExposure[];total:number;parameters:{probe:number;points:number}};
export type ExposureGroup='all'|'buried'|'exposed';
export const GROUP_FRACTION=0.25;

export function analyzeExposure(structure:ProteinStructure,points=SASA_POINTS):ExposureAnalysis{
 const atomSasa=shrakeRupley(structure.atoms,{points});
 const residues=structure.residues.map(r=>{
  const sasa=r.atoms.reduce((s,i)=>s+atomSasa[i],0),sideChainSasa=r.atoms.filter(i=>isSideChainAtom(structure.atoms[i])).reduce((s,i)=>s+atomSasa[i],0);
  return {index:r.index,resName:r.resName,resSeq:r.resSeq,chemical:classOf(r.resName),sasa,sideChainSasa,relative:sasa/MAX_ASA_TIEN_2013[r.resName],rank:0,percentile:0};
 });
 const order=[...residues].sort((a,b)=>a.relative-b.relative||a.resSeq-b.resSeq);
 order.forEach((r,i)=>{r.rank=i+1;r.percentile=residues.length>1?i/(residues.length-1):0;});
 return {atomSasa,residues,total:atomSasa.reduce((a,b)=>a+b,0),parameters:{probe:PROBE_RADIUS,points}};
}

/** Relative, within-protein groups: the lowest / highest `fraction` of residues by rSASA rank. */
export function groupIndices(residues:ResidueExposure[],group:ExposureGroup,fraction=GROUP_FRACTION):Set<number>{
 if(group==='all')return new Set(residues.map(r=>r.index));
 const size=Math.round(residues.length*fraction);
 return new Set(residues.filter(r=>group==='buried'?r.rank<=size:r.rank>residues.length-size).map(r=>r.index));
}

export type Composition=Record<ChemicalClass,number>&{total:number;glycine:number};
export function composition(residues:ResidueExposure[],indices:Set<number>):Composition{
 const counts=Object.fromEntries(CLASS_ORDER.map(c=>[c,0])) as Record<ChemicalClass,number>;
 let glycine=0,total=0;
 for(const r of residues)if(indices.has(r.index)){counts[r.chemical]++;total++;if(r.resName==='GLY')glycine++;}
 return {...counts,total,glycine};
}

/**
 * Data-derived exceptions (never hand-picked): the most exposed non-Gly nonpolar residue with full
 * occupancy in the exposed group, and the most buried polar/charged residue in the buried group.
 */
export function findExceptions(structure:ProteinStructure,residues:ResidueExposure[]){
 const exposed=groupIndices(residues,'exposed'),buried=groupIndices(residues,'buried'),byRank=[...residues].sort((a,b)=>a.rank-b.rank);
 const exposedNonpolar=[...byRank].reverse().find(r=>exposed.has(r.index)&&r.chemical==='nonpolar'&&r.resName!=='GLY'&&structure.residues[r.index].occupancy===1)??null;
 const buriedPolar=byRank.find(r=>buried.has(r.index)&&r.chemical!=='nonpolar'&&r.sideChainSasa<1)??null;
 return {exposedNonpolar,buriedPolar};
}

export type PolarContact={atom:string;partner:string;partnerResidue:number;distance:number};
/** Side-chain N/O to N/O of other residues within `cutoff` Å: distance only, no H or angle evaluated. */
export function polarContacts(structure:ProteinStructure,residueIndex:number,cutoff=3.5):PolarContact[]{
 const residue=structure.residues[residueIndex],contacts:PolarContact[]=[];
 for(const i of residue.atoms){
  const a=structure.atoms[i];
  if(!isSideChainAtom(a)||!['N','O'].includes(a.element))continue;
  structure.residues.forEach(other=>{
   if(other.index===residueIndex)return;
   for(const j of other.atoms){const b=structure.atoms[j];if(!['N','O'].includes(b.element))continue;const d=distance(a.position,b.position);if(d<=cutoff)contacts.push({atom:a.name,partner:`${other.resName[0]}${other.resName.slice(1).toLowerCase()} ${other.resSeq} ${b.name}`,partnerResidue:other.index,distance:d});}
  });
 }
 return contacts.sort((a,b)=>a.distance-b.distance);
}

/** Covalent bonds from heavy-atom distances: within a residue or peptide C(i)–N(i+1). */
const COVALENT:Record<string,number>={C:0.76,N:0.71,O:0.66,S:1.05};
export function inferBonds(structure:ProteinStructure,tolerance=0.45):[number,number][]{
 const bonds:[number,number][]=[];
 structure.residues.forEach((r,ri)=>{
  const candidates=[...r.atoms];
  for(let x=0;x<candidates.length;x++)for(let y=x+1;y<candidates.length;y++){
   const a=structure.atoms[candidates[x]],b=structure.atoms[candidates[y]];
   if(distance(a.position,b.position)<=COVALENT[a.element]+COVALENT[b.element]+tolerance)bonds.push([candidates[x],candidates[y]]);
  }
  const next=structure.residues[ri+1];
  if(next&&next.resSeq===r.resSeq+1){
   const c=r.atoms.find(i=>structure.atoms[i].name==='C'),n=next.atoms.find(i=>structure.atoms[i].name==='N');
   if(c!==undefined&&n!==undefined&&distance(structure.atoms[c].position,structure.atoms[n].position)<=COVALENT.C+COVALENT.N+tolerance)bonds.push([c,n]);
  }
 });
 return bonds;
}

export const formatExposure=(relative:number)=>relative>=1?'≥100%':`${Math.round(relative*100)}%`;
