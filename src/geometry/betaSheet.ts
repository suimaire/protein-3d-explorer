import {buildPeptide,point,angles,type Peptide} from './peptide';
import {helixGeometry} from './helix';
import {sub,dot,cross,unit,scale,type Vec} from './vector';
import {classifyInteractions} from './sterics';
export type SheetType='antiparallel'|'parallel';
export const BETA={count:7,strands:3,phi:-135,psi:132.27209925651545,stride:9} as const;
/** Repeated trans peptide with a 180-degree screw step: an untwisted pleated strand.
 * Project into a right-handed frame only; no atom-specific offsets or reflections. */
export function buildBetaStrand():Peptide {
 const m=buildPeptide(BETA.count,BETA.phi,BETA.psi),x=helixGeometry(m).axis;
 const v=sub(point(m,4,'O'),point(m,4,'C')),y=unit(sub(v,scale(x,dot(v,x)))),z=cross(x,y),origin=point(m,4,'CA');
 return {...m,atoms:m.atoms.map(a=>({...a,position:[dot(sub(a.position,origin),x),dot(sub(a.position,origin),y),dot(sub(a.position,origin),z)] as Vec}))};
}
/** Separately registered rigid strands. Both rotations have determinant +1.
 * Registration chosen by coordinate donor/acceptor and full cap-inclusive steric audit. */
export function buildBetaSheet(type:SheetType):Peptide {
 const source=buildBetaStrand(),atoms:Peptide['atoms']=[],bonds:Peptide['bonds']=[];
 for(let s=0;s<BETA.strands;s++){
  const reverse=type==='antiparallel'&&s%2===1,sign=reverse?-1:1,dx=type==='parallel'?0:[0,-0.4,-0.2][s],dy=type==='parallel'?s*4.8:[0,5.5,10][s];
  const rename=(id:string)=>{const [r,n]=id.split(':');return `${Number(r)+s*BETA.stride}:${n}`;};
  atoms.push(...source.atoms.map(a=>({...a,id:rename(a.id),residue:a.residue+s*BETA.stride,position:[sign*a.position[0]+dx,sign*a.position[1]+dy,a.position[2]] as Vec})));
  bonds.push(...source.bonds.map(b=>({...b,a:rename(b.a),b:rename(b.b)})));
 }
 return {atoms,bonds};
}
export const strandIndex=(residue:number)=>Math.floor(residue/BETA.stride);
export const localResidue=(residue:number)=>residue%BETA.stride;
export const residueLabel=(r:number)=>`Strand ${'ABC'[strandIndex(r)]} · Ala ${localResidue(r)}`;
export const betaAngles=(m:Peptide,strand:number,residue:number)=>angles(m,strand*BETA.stride+residue);
export function sheetHydrogenBonds(m:Peptide){return classifyInteractions(m).hydrogenBonds.filter(b=>strandIndex(b.acceptor)!==strandIndex(b.donor)&&[b.acceptor,b.donor].every(r=>localResidue(r)>=1&&localResidue(r)<=BETA.count));}
export function strandDirection(m:Peptide,s:number){return unit(sub(point(m,s*BETA.stride+BETA.count,'CA'),point(m,s*BETA.stride+1,'CA')));}
