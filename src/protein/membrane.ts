import type {Vec} from '../geometry/vector';
import {applyRigid,type RigidTransform} from './rigid';
import {CLASS_ORDER,type ChemicalClass} from './chemistry';
import {isSideChainAtom,type ProteinStructure} from './pdb';
import type {ResidueExposure} from './exposure';

/**
 * Membrane frame after the orientation transform: normal = +z, bilayer centre z = 0,
 * hydrophobic boundaries at z = ±halfThickness. The same object drives the 3D slab and classification.
 */
export type MembraneSlab={normal:Vec;center:number;halfThickness:number};
export const MEMBRANE_NORMAL:Vec=[0,0,1];

/**
 * Surface criterion shared by both proteins: whole-residue relative SASA ≥ 25 %.
 * A conventional rSASA cut-off (e.g. Levy 2010 surface ≥ 25 %); the validation document reports how the
 * counts shift at 15–30 %. Protein-alone SASA = "surface accessibility", not water exposure in a membrane.
 */
export const SURFACE_THRESHOLD=0.25;

/** Rigid-body copy: every atom gets the same rotation + translation; the input structure is untouched. */
export function transformStructure(structure:ProteinStructure,transform:RigidTransform):ProteinStructure{
 return {...structure,atoms:structure.atoms.map(a=>({...a,position:applyRigid(transform,a.position)})),residues:structure.residues.map(r=>({...r,atoms:[...r.atoms]}))};
}

export type MembraneZone='membrane'|'sideA'|'sideB';
export type SurfaceCategory='lipid-facing'|'aqueous-facing'|'buried';
export type ResidueMembrane={
 index:number;
 /** Signed z (Å) of the side-chain heavy-atom centroid (Gly: Cα) from the bilayer centre. */ depth:number;
 /** Signed z (Å) of Cα, reported for reference. */ caDepth:number;
 zone:MembraneZone;
 surface:boolean;
 category:SurfaceCategory;
};

export const zoneOf=(depth:number,slab:MembraneSlab):MembraneZone=>Math.abs(depth-slab.center)<=slab.halfThickness?'membrane':depth>slab.center?'sideA':'sideB';
export const isSurface=(r:{relative:number},threshold=SURFACE_THRESHOLD)=>r.relative>=threshold;

/** Side-chain reference point used for depth: centroid of side-chain heavy atoms; Gly uses Cα. */
export function sideChainCentroid(structure:ProteinStructure,residueIndex:number):Vec{
 const r=structure.residues[residueIndex],side=r.atoms.filter(i=>isSideChainAtom(structure.atoms[i])&&structure.atoms[i].name!=='OXT');
 const atoms=side.length?side:r.atoms.filter(i=>structure.atoms[i].name==='CA');
 if(!atoms.length)throw new Error(`Residue ${r.resSeq} has no reference atom`);
 return atoms.reduce<Vec>((s,i)=>{const p=structure.atoms[i].position;return [s[0]+p[0]/atoms.length,s[1]+p[1]/atoms.length,s[2]+p[2]/atoms.length];},[0,0,0]);
}

/**
 * SASA is invariant to rigid-body motion, but Shrake–Rupley test points are fixed in the coordinate frame, so a
 * rotated copy gives slightly different numbers. Exposure is therefore computed once on the deposited coordinates
 * and joined to the oriented residues by identity (resSeq + resName), never by recomputation or array position.
 */
export function matchExposure(oriented:ProteinStructure,exposure:ResidueExposure[]):ResidueExposure[]{
 const byId=new Map<string,ResidueExposure>(),key=(resSeq:number,resName:string)=>`${resSeq}:${resName}`;
 for(const e of exposure){const k=key(e.resSeq,e.resName);if(byId.has(k))throw new Error(`Duplicate exposure residue ${k}`);byId.set(k,e);}
 if(byId.size!==oriented.residues.length)throw new Error(`Exposure has ${byId.size} residues, structure ${oriented.residues.length}`);
 return oriented.residues.map(r=>{const e=byId.get(key(r.resSeq,r.resName));if(!e)throw new Error(`No exposure for ${r.resName}${r.resSeq}`);if(e.index!==r.index)throw new Error(`Exposure index mismatch for ${r.resName}${r.resSeq}`);return e;});
}

/**
 * Lipid-facing candidate = side chain inside the hydrophobic slab AND protein-surface residue (rSASA ≥ threshold).
 * Aqueous-facing = surface residue whose side chain lies outside the slab. Everything else = buried.
 * This is a geometric classification of a detergent-free protein model, not an observed lipid contact.
 */
export function classifyMembrane(oriented:ProteinStructure,exposure:ResidueExposure[],slab:MembraneSlab,threshold=SURFACE_THRESHOLD):ResidueMembrane[]{
 const matched=matchExposure(oriented,exposure);
 return oriented.residues.map(r=>{
  const depth=sideChainCentroid(oriented,r.index)[2],ca=r.atoms.find(i=>oriented.atoms[i].name==='CA'),zone=zoneOf(depth,slab),surface=isSurface(matched[r.index],threshold);
  return {index:r.index,depth,caDepth:ca===undefined?Number.NaN:oriented.atoms[ca].position[2],zone,surface,category:!surface?'buried':zone==='membrane'?'lipid-facing':'aqueous-facing'};
 });
}

export type Highlight='all'|'surface'|'buried'|'lipid'|'aqueous';
/** Residue indices for a highlight mode. A soluble protein (no slab) has no lipid-facing residues and all surface is aqueous-facing. */
export function highlightIndices(exposure:ResidueExposure[],membrane:ResidueMembrane[]|null,mode:Highlight,threshold=SURFACE_THRESHOLD):Set<number>{
 const pick=(f:(r:ResidueExposure)=>boolean)=>new Set(exposure.filter(f).map(r=>r.index));
 if(mode==='all')return pick(()=>true);
 if(mode==='surface')return pick(r=>isSurface(r,threshold));
 if(mode==='buried')return pick(r=>!isSurface(r,threshold));
 if(!membrane)return mode==='lipid'?new Set():pick(r=>isSurface(r,threshold));
 const category=mode==='lipid'?'lipid-facing':'aqueous-facing';
 return new Set(membrane.filter(m=>m.category===category).map(m=>m.index));
}

export type ClassCounts=Record<ChemicalClass,number>&{total:number;glycine:number};
export function countClasses(exposure:ResidueExposure[],indices:Set<number>):ClassCounts{
 const c=Object.fromEntries(CLASS_ORDER.map(k=>[k,0])) as Record<ChemicalClass,number>;let total=0,glycine=0;
 for(const r of exposure)if(indices.has(r.index)){c[r.chemical]++;total++;if(r.resName==='GLY')glycine++;}
 return {...c,total,glycine};
}
/**
 * Representative residues derived from the data (never hand-picked), full occupancy only:
 * lipid-facing non-Gly nonpolar nearest the bilayer centre; most surface-accessible aqueous-facing charged residue;
 * lipid-facing polar residue nearest the centre; buried charged residue inside the slab nearest the centre.
 */
export function findMembraneExamples(structure:ProteinStructure,exposure:ResidueExposure[],membrane:ResidueMembrane[]){
 const full=(m:ResidueMembrane)=>structure.residues[m.index].occupancy===1,chem=(m:ResidueMembrane)=>exposure[m.index].chemical;
 const nearest=(f:(m:ResidueMembrane)=>boolean)=>membrane.filter(m=>full(m)&&f(m)).sort((a,b)=>Math.abs(a.depth)-Math.abs(b.depth)||a.index-b.index)[0]??null;
 const charged=(m:ResidueMembrane)=>chem(m)==='acidic'||chem(m)==='basic';
 return {
  lipidNonpolar:nearest(m=>m.category==='lipid-facing'&&chem(m)==='nonpolar'&&exposure[m.index].resName!=='GLY'),
  aqueousCharged:membrane.filter(m=>full(m)&&m.category==='aqueous-facing'&&charged(m)).sort((a,b)=>exposure[b.index].relative-exposure[a.index].relative)[0]??null,
  lipidPolar:nearest(m=>m.category==='lipid-facing'&&chem(m)==='polar'),
  buriedCharged:nearest(m=>m.zone==='membrane'&&m.category==='buried'&&charged(m)),
 };
}
export const formatDepth=(z:number)=>`${z>=0?'+':'−'}${Math.abs(z).toFixed(1)} Å`;
